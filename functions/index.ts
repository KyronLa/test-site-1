import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as crypto from "crypto";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";

admin.initializeApp();
const db = admin.firestore();

// --- Sanitization Utility ---

/**
 * Checks for malicious patterns and returns a sanitized string.
 * Rejects SQL-like syntax, script tags, and Firestore operators.
 */
function sanitizeString(input: any): string {
  if (typeof input !== 'string') return String(input || '');

  const rejectedPatterns = [
    /<script\b[^>]*>([\s\S]*?)<\/script>/gim, // Script tags
    /\b(SELECT|DROP|INSERT|UPDATE|DELETE|UNION|TRUNCATE)\b/gim, // SQL-like
    /--|;|--\s*$/g, // SQL comments/separators
    /\b(==|!=|<|<=|>|>=|array-contains|in|not-in|array-contains-any)\b/g // Firestore operators
  ];

  for (const pattern of rejectedPatterns) {
    if (pattern.test(input)) {
      throw new HttpsError("invalid-argument", `Invalid input detected: Malicious patterns are not allowed in field.`);
    }
  }

  // Basic HTML stripping (since we don't have DOMPurify easily available in Node without jsdom)
  return input.replace(/<[^>]*>?/gm, '');
}

/**
 * Recursively sanitizes an object or array.
 */
function sanitizeData(data: any): any {
  if (typeof data === 'string') {
    return sanitizeString(data);
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  if (data !== null && typeof data === 'object' && !(data instanceof admin.firestore.FieldValue) && !(data instanceof admin.firestore.Timestamp)) {
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

/**
 * Verifies the Firebase ID token and returns the decoded token.
 * Throws an error if verification fails.
 */
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

/**
 * Verifies if the user is an admin based on their email.
 */
async function verifyAdmin(req: any): Promise<admin.auth.DecodedIdToken> {
  const decodedToken = await verifyToken(req);
  const adminEmails = ['info@eclipseresearch.shop', 'kyron.laskosky2@gmail.com'];
  if (!adminEmails.includes(decodedToken.email || '') || !decodedToken.email_verified) {
    throw new Error('Forbidden: Admin access required');
  }
  return decodedToken;
}

// --- Rate Limiting Utility ---

const RATE_LIMIT_PER_MINUTE = 60;

/**
 * Checks if a request should be rate limited.
 * Returns true if limited, false otherwise.
 */
async function isRateLimited(identifier: string, limit: number = RATE_LIMIT_PER_MINUTE): Promise<boolean> {
  const now = new Date();
  const minute = now.toISOString().substring(0, 16); // e.g., "2026-04-13T21:57"
  const docId = `${identifier.replace(/\./g, '_')}_${minute}`; // Replace dots in IP for safe doc ID
  const docRef = db.collection("rate_limits").doc(docId);

  try {
    const result = await db.runTransaction(async (transaction: admin.firestore.Transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) {
        transaction.set(docRef, {
          count: 1,
          expiresAt: admin.firestore.Timestamp.fromDate(new Date(now.getTime() + 5 * 60 * 1000)) // Expire in 5 mins
        });
        return false;
      } else {
        const data = doc.data();
        const count = (data?.count || 0) + 1;
        if (count > limit) {
          return true;
        }
        transaction.update(docRef, { count: count });
        return false;
      }
    });
    return result;
  } catch (error) {
    console.error("Rate limit check error:", error);
    return false; // Fail open to avoid blocking users on DB issues
  }
}

// --- Gemini AI Function ---
export const generateAIContent = onCall(async (request: any) => {
  // 1. Rate Limiting
  const identifier = request.auth?.uid || request.rawRequest.ip || "anonymous";
  if (await isRateLimited(identifier)) {
    throw new HttpsError("resource-exhausted", "Rate limit exceeded. Please try again in a minute.");
  }

  // 2. Check authentication
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  
  // Verify admin for AI content generation if it's for admin purposes
  const adminEmails = ['info@eclipseresearch.shop', 'kyron.laskosky2@gmail.com'];
  if (!adminEmails.includes(request.auth.token.email || '') || !request.auth.token.email_verified) {
    throw new HttpsError("permission-denied", "Admin access required for AI generation.");
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
      model: "gemini-2.0-flash-exp", // Updated to a non-prohibited model from skill
      contents: prompt
    });
    return { text: response.text };
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new HttpsError("internal", error.message || "Failed to generate content");
  }
});

/**
 * Rebuilt Bankful Session Creator
 * Based on official sandbox documentation
 */
export const createBankfulSession = onRequest(
  { cors: ["https://eclipseresearch.shop"], invoker: "public" },
  async (req: any, res: any) => {
    // 1. Rate Limiting
    if (await isRateLimited(req.ip || "unknown")) {
      res.status(429).json({ error: "Too Many Requests", message: "Rate limit exceeded. Please try again in a minute." });
      return;
    }

    // Handle Preflight
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "https://eclipseresearch.shop");
      res.set("Access-Control-Allow-Methods", "POST");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }

    try {
      // Verify authentication
      await verifyToken(req);

      const rawData = req.body;
      const { total, customerEmail, orderId, shippingInfo, cart, referralCode } = sanitizeData(rawData);

      // 1. Save pending order to Firestore
      await db.collection("orders").doc(orderId).set({
        orderId: orderId,
        customerName: `${shippingInfo?.firstName || ""} ${shippingInfo?.lastName || ""}`.trim(),
        customerEmail: customerEmail || "",
        shippingAddress: `${shippingInfo?.address || ""}, ${shippingInfo?.city || ""}, ${shippingInfo?.state || ""} ${shippingInfo?.zip || ""}`,
        items: cart || [],
        total: Number(total),
        status: "pending",
        referralCode: referralCode || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 2. Construct initial payload
      const payload: Record<string, any> = {
        req_username: process.env.BANKFUL_USERNAME || "testsandbox8@sanbox.com",
        transaction_type: "CAPTURE",
        amount: Number(total).toFixed(2),
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

      // 2. Generate Signature
      // Sort keys alphabetically, filter out null/undefined/empty, concatenate key+value
      const salt = process.env.BANKFUL_SALT || "Testsandbox@8";
      const payloadString = Object.keys(payload)
        .sort()
        .filter((key) => {
          const val = payload[key];
          return val !== null && val !== undefined && val !== "";
        })
        .map((key) => `${key}${payload[key]}`)
        .join("");

      console.log("Signature Payload String:", payloadString);

      const signature = crypto
        .createHmac("sha256", salt)
        .update(payloadString)
        .digest("hex");

      payload.signature = signature;

      console.log("Generated Signature:", signature);
      console.log("Final Payload sent to Bankful:", JSON.stringify(payload, null, 2));

      // 3. POST to Bankful Sandbox
      const bankfulRes = await fetch("https://api-dev1.bankfulportal.com/front-calls/go-in/hosted-page-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseStatus = bankfulRes.status;
      const responseText = await bankfulRes.text();

      console.log("Bankful API Status:", responseStatus);
      console.log("Bankful API Response:", responseText);

      // 4. Return response to frontend
      res.set("Access-Control-Allow-Origin", "https://eclipseresearch.shop");
      res.status(responseStatus).send(responseText);

    } catch (error: any) {
      console.error("Internal Function Error:", error);
      res.set("Access-Control-Allow-Origin", "https://eclipseresearch.shop");
      res.status(500).json({
        error: "Internal Server Error",
        message: error.message
      });
    }
  }
);

/**
 * Bankful Redirect Callback Handler
 * Updates order status to paid and redirects to success page
 */
export const bankfulCallback = onRequest(
  { invoker: "public" },
  async (req: any, res: any) => {
    // 1. Rate Limiting
    if (await isRateLimited(req.ip || "unknown")) {
      res.status(429).send("Too Many Requests");
      return;
    }

    console.log("Bankful Callback Received:", JSON.stringify(req.body || req.query, null, 2));

    try {
      const orderId = req.body?.xtl_order_id || req.query?.xtl_order_id || req.body?.TRANS_REQUEST_ID || req.query?.TRANS_REQUEST_ID;

      if (orderId) {
        await db.collection("orders").doc(orderId as string).update({
          status: "paid",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Order ${orderId} updated to paid via callback`);
      }

      res.redirect("https://eclipseresearch.shop/order-success.html");
    } catch (error: any) {
      console.error("Callback Error:", error);
      // Even if update fails, redirect to success page so user isn't stuck
      res.redirect("https://eclipseresearch.shop/order-success.html");
    }
  }
);

/**
 * Bankful Webhook Handler
 */
export const bankfulWebhook = onRequest(
  { invoker: "public" },
  async (req: any, res: any) => {
    // 1. Rate Limiting
    if (await isRateLimited(req.ip || "unknown")) {
      res.status(429).send("Too Many Requests");
      return;
    }

    console.log("Bankful Webhook Received:", JSON.stringify(req.body, null, 2));

    try {
      const { xtl_order_id, response_code } = req.body;

      if (!xtl_order_id) {
        res.status(400).send("Missing xtl_order_id");
        return;
      }

      // response_code "100" means approved in Bankful
      if (response_code === "100") {
        await db.collection("orders").doc(xtl_order_id).update({
          status: "paid",
          paidAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Order ${xtl_order_id} updated to paid via webhook`);
      }

      res.status(200).send("OK");
    } catch (error: any) {
      console.error("Webhook Error:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

/**
 * saveOrder function
 * Receives order data from client-side success page and saves to Firestore
 */
export const saveOrder = onRequest(
  { cors: true, invoker: "public" },
  async (req: any, res: any) => {
    // 1. Rate Limiting
    if (await isRateLimited(req.ip || "unknown")) {
      res.status(429).json({ error: "Too Many Requests" });
      return;
    }

    console.log("saveOrder called with:", JSON.stringify(req.body, null, 2));
    try {
      // Verify authentication
      await verifyToken(req);

      const sanitizedBody = sanitizeData(req.body);
      const { orderId, transactionId, total, status, requestAction, transStatusName } = sanitizedBody;

      if (!orderId) {
        res.status(400).json({ error: "Missing orderId" });
        return;
      }

      // Save/Update order with requested fields
      await db.collection("orders").doc(orderId).set({
        orderId,
        transactionId: transactionId || "",
        total: Number(total) || 0,
        status: status || "paid",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        requestAction: requestAction || "",
        transStatusName: transStatusName || "",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      res.status(200).json({ success: true, orderId });
    } catch (error: any) {
      console.error("Error in saveOrder:", error);
      res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
  }
);

// --- Firestore Triggers for Sanitization ---

/**
 * Trigger to sanitize data in 'orders' collection
 */
export const onOrderWrite = onDocumentWritten("orders/{orderId}", async (event: any) => {
  const data = event.data?.after?.exists ? event.data.after.data() : null;
  if (!data) return null;

  try {
    const sanitized = sanitizeData(data);
    // Only update if data actually changed after sanitization
    if (JSON.stringify(data) !== JSON.stringify(sanitized)) {
      return event.data.after.ref.set(sanitized, { merge: true });
    }
  } catch (error) {
    console.error("Sanitization error in orders trigger:", error);
    // If it's a rejection error, we might want to flag the document
    return event.data.after.ref.update({ flagged: true, sanitizationError: (error as any).message });
  }
  return null;
});

/**
 * Trigger to sanitize data in 'users' collection
 */
export const onUserWrite = onDocumentWritten("users/{userId}", async (event: any) => {
  const data = event.data?.after?.exists ? event.data.after.data() : null;
  if (!data) return null;

  try {
    const sanitized = sanitizeData(data);
    if (JSON.stringify(data) !== JSON.stringify(sanitized)) {
      return event.data.after.ref.set(sanitized, { merge: true });
    }
  } catch (error) {
    console.error("Sanitization error in users trigger:", error);
    return event.data.after.ref.update({ flagged: true, sanitizationError: (error as any).message });
  }
  return null;
});

/**
 * Trigger to sanitize data in 'coa_requests' collection
 */
export const onCoaRequestWrite = onDocumentWritten("coa_requests/{requestId}", async (event: any) => {
  const data = event.data?.after?.exists ? event.data.after.data() : null;
  if (!data) return null;

  try {
    const sanitized = sanitizeData(data);
    if (JSON.stringify(data) !== JSON.stringify(sanitized)) {
      return event.data.after.ref.set(sanitized, { merge: true });
    }
  } catch (error) {
    console.error("Sanitization error in coa_requests trigger:", error);
    return event.data.after.ref.update({ flagged: true, sanitizationError: (error as any).message });
  }
  return null;
});

/**
 * Trigger to sanitize data in 'affiliate_applications' collection
 */
export const onAffiliateApplicationWrite = onDocumentWritten("affiliate_applications/{applicationId}", async (event: any) => {
  const data = event.data?.after?.exists ? event.data.after.data() : null;
  if (!data) return null;

  try {
    const sanitized = sanitizeData(data);
    if (JSON.stringify(data) !== JSON.stringify(sanitized)) {
      return event.data.after.ref.set(sanitized, { merge: true });
    }
  } catch (error) {
    console.error("Sanitization error in affiliate_applications trigger:", error);
    return event.data.after.ref.update({ flagged: true, sanitizationError: (error as any).message });
  }
  return null;
});
/**
 * Updates the status of an existing order
 */
export const updateOrderStatus = onRequest(
  { cors: true, invoker: "public" },
  async (req: any, res: any) => {
    // 1. Rate Limiting
    if (await isRateLimited(req.ip || "unknown")) {
      res.status(429).json({ error: "Too Many Requests" });
      return;
    }

    console.log("updateOrderStatus called with:", JSON.stringify(req.body, null, 2));
    try {
      // Verify admin access
      await verifyAdmin(req);

      const { orderId, status } = req.body;

      if (!orderId || !status) {
        res.status(400).json({ error: "Missing orderId or status" });
        return;
      }

      await db.collection("orders").doc(orderId).update({
        status: status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.status(200).json({ success: true, orderId, status });
    } catch (error: any) {
      console.error("Error in updateOrderStatus:", error);
      res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
  }
);
