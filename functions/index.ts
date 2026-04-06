import { onRequest } from "firebase-functions/v2/https";
import * as crypto from "crypto";

export const createBankfulSession = onRequest(
  { cors: ["https://eclipseresearch.shop"], invoker: "public" },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "https://eclipseresearch.shop");
      res.set("Access-Control-Allow-Methods", "POST");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }

    const { total, customerEmail, orderId, shippingInfo } = req.body;

    const payload: Record<string, string> = {
      req_username: "testsandbox8@sanbox.com",
      transaction_type: "CAPTURE",
      amount: Number(total).toFixed(2),
      request_currency: "USD",
      cust_email: customerEmail || "",
      cust_fname: shippingInfo?.firstName || "",
      cust_lname: shippingInfo?.lastName || "",
      cust_phone: "0000000000",
      bill_addr: shippingInfo?.address || "",
      bill_addr_city: shippingInfo?.city || "",
      bill_addr_state: shippingInfo?.state || "",
      bill_addr_zip: shippingInfo?.zip || "",
      bill_addr_country: "US",
      xtl_order_id: orderId || "000001",
      cart_name: "Hosted-Page",
      url_complete: "https://eclipseresearch.shop/order-success",
      url_failed: "https://eclipseresearch.shop/order-failed",
      url_cancel: "https://eclipseresearch.shop/checkout",
      url_pending: "https://eclipseresearch.shop/order-pending",
      url_callback: "https://us-central1-gen-lang-client-0437247227.cloudfunctions.net/bankfulCallback",
      return_redirect_url: "Y",
    };

    const salt = "Testsandbox@8";
    const payloadString = Object.keys(payload)
      .sort()
      .filter((k) => payload[k] !== undefined && payload[k] !== null && payload[k] !== "")
      .map((k) => `${k}${payload[k]}`)
      .join("");

    console.log("Signature Payload String:", payloadString);

    const signature = crypto.createHmac("sha256", salt).update(payloadString).digest("hex");
    payload.signature = signature;

    console.log("Generated Signature:", signature);
    console.log("Final Payload sent to Bankful:", JSON.stringify(payload, null, 2));

    const bankfulRes = await fetch("https://api-dev1.bankfulportal.com/front-calls/go-in/hosted-page-pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await bankfulRes.text();
    console.log("Bankful status:", bankfulRes.status);
    console.log("Full Bankful response body:", text);

    res.set("Access-Control-Allow-Origin", "https://eclipseresearch.shop");
    res.status(bankfulRes.status).send(text);
  }
);
