import { onRequest } from "firebase-functions/v2/https";
import * as crypto from "crypto";

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
      const { total, customerEmail, orderId, shippingInfo } = req.body;

      // 1. Construct initial payload
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
        url_complete: "https://eclipseresearch.shop/order-success",
        url_failed: "https://eclipseresearch.shop/order-failed",
        url_callback: "https://eclipseresearch.shop/order-callback",
        url_pending: "https://eclipseresearch.shop/order-pending",
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
