import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as crypto from "crypto";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";
import express from "express";
import fetch from "node-fetch";

admin.initializeApp();
const db = admin.firestore();

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

    // Sanitize and extract data
    const customerEmail = sanitizeString(rawData.customerEmail || "");
    const orderId = sanitizeString(rawData.orderId || "000001");
    const shippingInfo = rawData.shippingInfo ? sanitizeData(rawData.shippingInfo) : {};
    const cart = rawData.cart ? sanitizeData(rawData.cart) : [];
    const referralCode = sanitizeString(rawData.referralCode || "");
    const promoCode = sanitizeString(rawData.promoCode || "");
    const promoDiscountValue = parseFloat(String(rawData.promoDiscount)) || 0;

    // Save pending order to Firestore - This ensures the order is visible in the admin panel
    // even before the payment is completed, and allows the callback/webhook to find it.
    await db.collection("orders").doc(orderId).set({
      orderId: orderId,
      userId: request.auth?.uid || "anonymous",
      customerName: `${shippingInfo?.firstName || ""} ${shippingInfo?.lastName || ""}`.trim(),
      email: customerEmail,
      shippingAddress: `${shippingInfo?.address || ""}, ${shippingInfo?.city || ""}, ${shippingInfo?.state || ""} ${shippingInfo?.zip || ""}`,
      items: cart,
      total: totalValue,
      status: "PENDING",
      referral: referralCode || null,
      promoCode: promoCode || null,
      promoDiscount: promoDiscountValue,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Build payload - credentials hardcoded, NOT run through sanitizer
    const payload: Record<string, any> = {
      req_username: "info@eclipseresearch.shop",
      transaction_type: "SALE",
      amount: totalValue.toFixed(2),
      request_currency: "USD",
      cust_email: customerEmail,
      cust_fname: shippingInfo?.firstName || "",
      cust_lname: shippingInfo?.lastName || "",
      cust_phone: shippingInfo?.phone || "9999212345",
      bill_addr: shippingInfo?.address || "",
      bill_addr_city: shippingInfo?.city || "",
      bill_addr_state: shippingInfo?.state || "",
      bill_addr_zip: shippingInfo?.zip || "",
      bill_addr_country: "US",
      xtl_order_id: orderId,
      cart_name: "Hosted-Page",
      url_cancel: "https://eclipseresearch.shop/checkout",
      url_complete: "https://us-central1-gen-lang-client-0437247227.cloudfunctions.net/bankfulCallback",
      url_failed: "https://eclipseresearch.shop",
      url_callback: "https://us-central1-gen-lang-client-0437247227.cloudfunctions.net/bankfulWebhook",
      url_pending: "https://eclipseresearch.shop",
      return_redirect_url: "Y",
    };

    // Generate Signature - per Bankful docs: sort keys alphabetically,
    // exclude empty values, concatenate as key1value1key2value2...
    const salt = "Munyun1028!!";

    const payloadString = Object.keys(payload)
      .sort()
      .filter((k) => payload[k] !== undefined && payload[k] !== null && payload[k] !== "")
      .map((k) => `${k}${payload[k]}`)
      .join("");

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

    console.log("BANKFUL STATUS:", bankfulRes.status);
    console.log("BANKFUL RESPONSE:", responseText);

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
      // In redirect callbacks, parameters are often in the query string
      const orderId = req.query?.xtl_order_id || req.body?.xtl_order_id;
      const transactionId = req.query?.transaction_id || req.body?.transaction_id || req.query?.TRANS_ID || req.body?.TRANS_ID;
      const responseCode = req.query?.response_code || req.body?.response_code;

      if (orderId && responseCode === "100") {
        console.log(`Updating order ${orderId} to PAID via callback. Transaction ID: ${transactionId}`);
        await db.collection("orders").doc(orderId as string).update({
          status: "paid",
          transactionId: transactionId || "",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

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
    try {
      const { xtl_order_id, transaction_id, response_code } = req.body;

      if (xtl_order_id && response_code === "100") {
        console.log(`Updating order ${xtl_order_id} to PAID via webhook. Transaction ID: ${transaction_id}`);
        await db.collection("orders").doc(xtl_order_id as string).update({
          status: "paid",
          transactionId: transaction_id || "",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      res.status(200).send("OK");
    } catch (error) {
      console.error("Webhook Update Error:", error);
      res.status(500).send("Internal Server Error");
    }
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

// --- Sync Orders to Google Sheets ---
const GOOGLE_SHEETS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxS7FLiSRrtJLHdI2mmGSTeHfS57Kdz1zxUHJJRtkIoTxhLqekEUKskAgd8pEfx5rH41g/exec";

async function syncOrderToSheets(orderData: any, docId: string) {
  console.log(`[SHEETS SYNC] Starting sync for order ${docId}...`);
  if (!GOOGLE_SHEETS_WEB_APP_URL || GOOGLE_SHEETS_WEB_APP_URL.includes("REPLACE_WITH")) {
    console.log("[SHEETS SYNC] Google Sheets Web App URL not configured. Skipping sync.");
    return;
  }

  try {
    // Handle variations in field names across the app
    const customerName = orderData.customerName || 
                        (orderData.shippingInfo ? `${orderData.shippingInfo.firstName} ${orderData.shippingInfo.lastName}` : "Guest");
    
    const email = orderData.email || orderData.customerEmail || 
                 (orderData.shippingInfo ? orderData.shippingInfo.email : "N/A");

    const shippingAddress = orderData.shippingAddress || 
                           (orderData.shippingInfo ? `${orderData.shippingInfo.address}${orderData.shippingInfo.unitNumber ? `, ${orderData.shippingInfo.unitNumber}` : ""}, ${orderData.shippingInfo.city}, ${orderData.shippingInfo.state} ${orderData.shippingInfo.zip}` : "N/A");

    // Format items as a readable string for the sheet
    const itemsString = Array.isArray(orderData.items) 
      ? orderData.items.map((item: any) => `${item.quantity || 1}x ${item.name || item.productName || 'Item'}`).join(', ')
      : "N/A";

    const payload = {
      orderId: orderData.orderId || docId,
      createdAt: orderData.createdAt ? (orderData.createdAt.toDate ? orderData.createdAt.toDate().toISOString() : orderData.createdAt) : new Date().toISOString(),
      customerName: customerName,
      email: email,
      shippingAddress: shippingAddress,
      items: itemsString,
      total: orderData.total || 0,
      status: (orderData.status || "pending").toUpperCase(),
      promoCode: orderData.promoCode || orderData.discountCode || "",
      referral: orderData.referral || orderData.referralCode || "",
      transactionId: orderData.transactionId || "",
      trackingNumber: orderData.trackingNumber || ""
    };

    console.log(`[SHEETS SYNC] Sending payload to ${GOOGLE_SHEETS_WEB_APP_URL}:`, JSON.stringify(payload));

    const response = await fetch(GOOGLE_SHEETS_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log(`[SHEETS SYNC] Response status: ${response.status}. Body: ${responseText}`);

    if (!response.ok) {
      throw new Error(`Google Sheets responded with ${response.status}: ${responseText}`);
    }

    console.log(`[SHEETS SYNC] Successfully synced order ${docId} to Google Sheets`);
  } catch (error) {
    console.error(`[SHEETS SYNC] Error syncing order ${docId} to Google Sheets:`, error);
  }
}

export const onOrderCreatedSyncToSheets = onDocumentCreated("orders/{orderId}", async (event) => {
  console.log(`[TRIGGER] orderCreated: ${event.params.orderId}`);
  const snapshot = event.data;
  if (!snapshot) {
    console.error("[TRIGGER] snapshot is missing");
    return;
  }
  await syncOrderToSheets(snapshot.data(), event.params.orderId);
});

export const onOrderUpdatedSyncToSheets = onDocumentUpdated("orders/{orderId}", async (event) => {
  console.log(`[TRIGGER] orderUpdated: ${event.params.orderId}`);
  const after = event.data?.after;
  const before = event.data?.before;
  if (!after || !before) {
    console.error("[TRIGGER] snapshot data is missing");
    return;
  }

  const dataAfter = after.data();
  const dataBefore = before.data();

  // Sync if status, transactionId, trackingNumber, or promo/referral info changed
  if (dataAfter.status !== dataBefore.status || 
      dataAfter.transactionId !== dataBefore.transactionId || 
      dataAfter.trackingNumber !== dataBefore.trackingNumber ||
      dataAfter.referralCredited !== dataBefore.referralCredited) {
    console.log(`[TRIGGER] Relevant change detected for ${event.params.orderId}`);
    await syncOrderToSheets(dataAfter, event.params.orderId);
  } else {
    console.log(`[TRIGGER] No relevant changes for ${event.params.orderId}. skipping sync.`);
  }
});
