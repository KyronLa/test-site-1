import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import * as crypto from "crypto";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";
import express from "express";
import fetch from "node-fetch";

admin.initializeApp();

// --- Sanitization Utility ---

function sanitizeString(input: any): string {
  if (typeof input !== 'string') return String(input || '');

  const rejectedPatterns = [
    /<script\b[^>]*>([\s\S]*?)<\/script>/gim,
    /\b(SELECT|DROP|INSERT|UPDATE|DELETE|UNION|TRUNCATE)\b/gim,
    /--|;|--\s*$/g,
    /\b(==|!=|<|<=|>|>=|array-contains|in|not-in|array-contains-any)\b/g
  ];

  for (const pattern of rejectedPatterns) {
    if (pattern.test(input)) {
      throw new HttpsError("invalid-argument", `Invalid input detected: Malicious patterns are not allowed in field.`);
    }
  }

  return input.replace(/<[^>]*>?/gm, '');
}

function sanitizeData(data: any): any {
  if (typeof data === 'string') {
    return sanitizeString(data);
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  if (data !== null && typeof data === 'object') {
    const sanitized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        sanitized[key] = sanitizeData(data[key]);
      }
    }
    return sanitized;
  }

  return data;
}

// --- Authentication Utility ---

async function verifyToken(req: any): Promise<admin.auth.DecodedIdToken> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or invalid Authorization header');
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    throw new Error('Unauthorized: Invalid ID token');
  }
}

async function verifyAdmin(req: any): Promise<admin.auth.DecodedIdToken> {
  const decodedToken = await verifyToken(req);
  return decodedToken;
}

// --- Gemini AI Function ---
export const generateAIContent = onCall(async (request: any) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  
  const { prompt } = request.data;
  if (!prompt) {
    throw new HttpsError("invalid-argument", "The function must be called with a 'prompt' argument.");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "The Gemini API key is not configured.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp", 
      contents: prompt
    });
    return { text: response.text };
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new HttpsError("internal", error.message || "Failed to generate content");
  }
});

// --- Bankful Session Creator ---
export const createBankfulSession = onCall(async (request) => {
  try {
    const rawData = request.data;
    
    const totalValue = parseFloat(String(rawData.total));
    
    if (isNaN(totalValue)) {
      console.error("Invalid total received:", rawData.total);
      throw new HttpsError("invalid-argument", "The total amount is invalid.");
    }

    const sanitizedData = sanitizeData(rawData);
    const { customerEmail, orderId, shippingInfo } = sanitizedData;

    // Build payload
    const payload: Record<string, any> = {
      req_username: "info@eclipseresearch.shop",
      transaction_type: "CAPTURE",
      amount: totalValue.toFixed(2),
      request_currency: "USD",
      cust_email: customerEmail || "",
      cust_fname: shippingInfo?.firstName || "",
      cust_lname: shippingInfo?.lastName || "",
      cust_phone: shippingInfo?.phone || "9999212345",
      bill_addr: shippingInfo?.address || "",
      bill_addr_city: shippingInfo?.city || "",
      bill_addr_state: shippingInfo?.state || "",
      bill_addr_zip: shippingInfo?.zip || "",
      bill_addr_country: "US",
      xtl_order_id: orderId || "000001",
      cart_name: "Hosted-Page",
      url_cancel: "https://eclipseresearch.shop/checkout",
      url_complete: "https://us-central1-gen-lang-client-0437247227.cloudfunctions.net/bankfulCallback",
      url_failed: "https://eclipseresearch.shop",
      url_callback: "https://us-central1-gen-lang-client-0437247227.cloudfunctions.net/bankfulWebhook",
      url_pending: "https://eclipseresearch.shop",
      return_redirect_url: "Y",
    };

    // Generate Signature
    const salt = "Munyun1028!!";

    const sortedKeys = Object.keys(payload).sort();
    const filteredKeys = sortedKeys.filter((key) => {
      const val = payload[key];
      return val !== null && val !== undefined && val !== "";
    });
    const payloadString = filteredKeys.map((key) => `${key}${payload[key]}`).join("");

    console.log("SORTED FILTERED KEYS:", filteredKeys);
    console.log("SIGNATURE PAYLOAD STRING:", payloadString);

    const signature = crypto
      .createHmac("sha256", salt)
      .update(payloadString)
      .digest("hex");

    console.log("GENERATED SIGNATURE:", signature);

    payload.signature = signature;

    // POST to Bankful
    const bankfulRes = await fetch("https://api.paybybankful.com/front-calls/go-in/hosted-page-pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const responseText = await bankfulRes.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { raw: responseText };
    }

    console.log("===== BANKFUL API DEBUG START =====");
    console.log("Status Code:", bankfulRes.status);
    console.log("Raw Response Text:", responseText);
    console.log("Parsed Response Data:", JSON.stringify(responseData, null, 2));
    console.log("===== BANKFUL API DEBUG END =====");

    if (!bankfulRes.ok || responseData.status === "error") {
      const errorMsg = responseData.errorMessage || responseData.error || "Bankful session creation failed";
      throw new HttpsError("internal", errorMsg, responseData);
    }

    return { data: responseData };
  } catch (error: any) {
    console.error("Bankful Session Error:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message || "Failed to create Bankful session");
  }
});

// --- Bankful Callback ---
export const bankfulCallback = onRequest(
  { invoker: "public" },
  async (req: any, res: any) => {
    console.log("Bankful Callback Received:", JSON.stringify(req.body || req.query, null, 2));
    try {
      res.redirect("https://eclipseresearch.shop/order-success.html");
    } catch (error: any) {
      console.error("Callback Error:", error);
      res.redirect("https://eclipseresearch.shop/order-success.html");
    }
  }
);

// --- Bankful Webhook ---
export const bankfulWebhook = onRequest(
  { invoker: "public" },
  async (req: any, res: any) => {
    console.log("Bankful Webhook Received:", JSON.stringify(req.body, null, 2));
    res.status(200).send("OK");
  }
);

// --- Delete User ---
export const deleteUser = onCall(async (request: any) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const { targetUid } = request.data;
  if (!targetUid) {
    throw new HttpsError("invalid-argument", "The function must be called with a 'targetUid' argument.");
  }

  if (targetUid === request.auth.uid) {
    throw new HttpsError("failed-precondition", "You cannot delete your own account from the admin dashboard.");
  }

  try {
    await admin.auth().deleteUser(targetUid);
    return { success: true, message: `User ${targetUid} has been successfully deleted.` };
  } catch (error: any) {
    console.error("Error deleting user:", error);
    throw new HttpsError("internal", error.message || "Failed to delete user");
  }
});

// --- Submit Webhook ---
export const submitWebhook = onCall(async (request) => {
  try {
    const data = request.data;
    const registrationUrl = "https://script.google.com/macros/s/AKfycbzIF_1AWjs5w38p45C2FllgN4UgS1FkcXogPuRnEtZhOzXHarmrEVDJRl1JeXDP961J4w/exec";
    
    const response = await fetch(registrationUrl, {
      method: "POST",
      body: JSON.stringify(data),
    });

    return { success: response.ok };
  } catch (error: any) {
    console.error("Webhook Error:", error);
    throw new HttpsError("internal", error.message || "Webhook failed");
  }
});
