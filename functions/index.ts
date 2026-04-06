import { onRequest } from "firebase-functions/v2/https";
import * as crypto from "crypto";

export const createBankfulSession = onRequest(
  { cors: true, invoker: "public" },
  async (req, res) => {
    const { cart, total, customerEmail, orderId, shippingInfo } = req.body;

    const payload: any = {
      req_username: "info@eclipseresearch.shop",
      transaction_type: "CAPTURE",
      amount: Number(total).toFixed(2),
      request_currency: "USD",
      cust_email: customerEmail,
      cust_fname: shippingInfo?.firstName || "",
      cust_lname: shippingInfo?.lastName || "",
      cust_phone: shippingInfo?.phone || "0000000000",
      bill_addr: shippingInfo?.address || "",
      bill_addr_city: shippingInfo?.city || "",
      bill_addr_state: shippingInfo?.state || "",
      bill_addr_zip: shippingInfo?.zip || "",
      bill_addr_country: "US",
      xtl_order_id: orderId,
      cart_name: "Hosted-Page",
      url_complete: "https://eclipseresearch.shop/order-success",
      url_failed: "https://eclipseresearch.shop/order-failed",
      url_cancel: "https://eclipseresearch.shop/checkout",
      url_pending: "https://eclipseresearch.shop/order-pending",
      url_callback: "https://us-central1-gen-lang-client-0437247227.cloudfunctions.net/bankfulCallback",
      return_redirect_url: "Y",
    };

    const salt = "Munyun1028!!";
    const payloadString = Object.keys(payload)
      .sort()
      .filter((k) => payload[k] !== undefined && payload[k] !== null && payload[k] !== "")
      .map((k) => `${k}${payload[k]}`)
      .join("");

    payload.signature = crypto.createHmac("sha256", salt).update(payloadString).digest("hex");

    console.log("Sending payload to Bankful:", JSON.stringify(payload, null, 2));

    try {
      const response = await fetch("https://api.paybybankful.com/front-calls/go-in/hosted-page-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Bankful API error: ${response.status} ${response.statusText}`, errorText);
        return res.status(response.status).json({ error: "Bankful API error", details: errorText });
      }

      const data = await response.json();
      console.log("Bankful response:", data);
      return res.json(data);
    } catch (error: any) {
      console.error("Fetch error when calling Bankful:", error);
      return res.status(500).json({ 
        error: "Failed to fetch from Bankful", 
        message: error.message,
        stack: error.stack 
      });
    }
  }
);
