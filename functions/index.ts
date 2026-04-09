import { onRequest } from "firebase-functions/v2/https";
import * as crypto from "crypto";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

/**
 * Rebuilt Bankful Session Creator
 * Based on official sandbox documentation
 */
export const createBankfulSession = onRequest(
  { cors: ["https://eclipseresearch.shop"], invoker: "public" },
  async (req, res) => {
    // Handle Preflight
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "https://eclipseresearch.shop");
      res.set("Access-Control-Allow-Methods", "POST");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }

    try {
      const { total, customerEmail, orderId, shippingInfo, cart } = req.body;

      // 1. Save pending order to Firestore
      await db.collection("orders").doc(orderId).set({
        orderId,
        customerEmail: customerEmail || "",
        customerName: `${shippingInfo?.firstName || ""} ${shippingInfo?.lastName || ""}`.trim(),
        amount: Number(total),
        totalAmount: Number(total),
        status: "pending",
        shippingInfo: {
          address: shippingInfo?.address || "",
          city: shippingInfo?.city || "",
          state: shippingInfo?.state || "",
          zip: shippingInfo?.zip || "",
          phone: shippingInfo?.phone || ""
        },
        shippingAddress: `${shippingInfo?.address || ""}, ${shippingInfo?.city || ""}, ${shippingInfo?.state || ""} ${shippingInfo?.zip || ""}`,
        items: cart || [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 2. Construct initial payload
      const payload: Record<string, any> = {
        req_username: "testsandbox8@sanbox.com",
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
        url_complete: "https://eclipseresearch.shop/order-success.html",
        url_failed: "https://eclipseresearch.shop",
        url_callback: "https://us-central1-gen-lang-client-0437247227.cloudfunctions.net/bankfulWebhook",
        url_pending: "https://eclipseresearch.shop",
        return_redirect_url: "Y",
      };

      // 2. Generate Signature
      // Sort keys alphabetically, filter out null/undefined/empty, concatenate key+value
      const salt = "Testsandbox@8";
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
 * Bankful Webhook Handler
 * Updates order status in Firestore when payment is approved
 */
export const bankfulWebhook = onRequest(
  { invoker: "public" },
  async (req, res) => {
    console.log("Bankful Webhook Received:", JSON.stringify(req.body, null, 2));

    try {
      const { 
        xtl_order_id, 
        response_code, 
        response_text,
        cust_fname,
        cust_lname,
        cust_email,
        bill_addr,
        bill_addr_city,
        bill_addr_state,
        bill_addr_zip,
        amount
      } = req.body;

      if (!xtl_order_id) {
        res.status(400).send("Missing xtl_order_id");
        return;
      }

      // response_code "100" usually means approved in Bankful
      const isApproved = response_code === "100" || response_text?.toLowerCase().includes("approved");
      
      if (isApproved) {
        // Save/Update order with requested fields and 'paid' status
        await db.collection("orders").doc(xtl_order_id).set({
          orderId: xtl_order_id,
          customerName: `${cust_fname || ""} ${cust_lname || ""}`.trim(),
          customerEmail: cust_email || "",
          shippingAddress: `${bill_addr || ""}, ${bill_addr_city || ""}, ${bill_addr_state || ""} ${bill_addr_zip || ""}`,
          totalAmount: Number(amount) || 0,
          status: "paid",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          bankfulResponse: req.body,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log(`Order ${xtl_order_id} updated to paid`);
      } else {
        await db.collection("orders").doc(xtl_order_id).update({
          status: "failed",
          bankfulResponse: req.body,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Order ${xtl_order_id} updated to failed`);
      }

      res.status(200).send("OK");
    } catch (error: any) {
      console.error("Webhook Error:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);
