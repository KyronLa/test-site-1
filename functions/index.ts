// Last deployed: 2026-04-06T03:17:13Z
import { onRequest } from "firebase-functions/v2/https";
import * as crypto from "crypto";

export const createBankfulSession = onRequest(
  { cors: true, invoker: "public" },
  async (req, res) => {
    console.log("Request Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Request Body:", JSON.stringify(req.body, null, 2));

    let data = req.body;
    // Handle cases where body might be wrapped in a 'data' field (like onCall)
    if (data && data.data) {
      console.log("Extracting data from 'data' wrapper");
      data = data.data;
    }

    const { cart, total, customerEmail, orderId, shippingInfo } = data || {};

    const rawPayload: any = {
      req_username: "info@eclipseresearch.shop",
      transaction_type: "CAPTURE",
      amount: total ? Number(total).toFixed(2) : "0.00",
      request_currency: "USD",
      cust_email: customerEmail || "",
      cust_fname: shippingInfo?.firstName || "",
      cust_lname: shippingInfo?.lastName || "",
      cust_phone: shippingInfo?.phone || "0000000000",
      bill_addr: shippingInfo?.address || "",
      bill_addr_city: shippingInfo?.city || "",
      bill_addr_state: shippingInfo?.state || "",
      bill_addr_zip: shippingInfo?.zip || "",
      bill_addr_country: "US",
      xtl_order_id: orderId || "unknown",
      cart_name: "Hosted-Page",
      url_complete: "https://eclipseresearch.shop/order-success",
      url_failed: "https://eclipseresearch.shop/order-failed",
      url_cancel: "https://eclipseresearch.shop/checkout",
      url_pending: "https://eclipseresearch.shop/order-pending",
      url_callback: "https://us-central1-gen-lang-client-0437247227.cloudfunctions.net/bankfulCallback",
      return_redirect_url: "Y",
    };

    // Filter out null, undefined, or empty string values
    const filteredPayload: Record<string, string> = {};
    Object.keys(rawPayload).forEach(key => {
      const val = rawPayload[key];
      if (val !== null && val !== undefined && val !== "") {
        filteredPayload[key] = String(val);
      }
    });

    // Sort keys alphabetically and concatenate as key1value1key2value2...
    const sortedKeys = Object.keys(filteredPayload).sort();
    const signatureString = sortedKeys.map(key => `${key}${filteredPayload[key]}`).join("");
    
    console.log("Signature String before hashing:", signatureString);

    const salt = "Munyun1028!!";
    const signature = crypto.createHmac("sha256", salt).update(signatureString).digest("hex");

    const finalPayload = {
      ...filteredPayload,
      signature
    };

    console.log("Sending payload to Bankful:", JSON.stringify(finalPayload, null, 2));

    try {
      const response = await fetch("https://api.paybybankful.com/front-calls/go-in/hosted-page-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalPayload),
      });

      const responseStatus = response.status;
      const responseStatusText = response.statusText;
      const responseBody = await response.text();
      
      console.log(`Bankful API Response Status: ${responseStatus} ${responseStatusText}`);
      console.log(`Bankful API Response Body: ${responseBody}`);

      if (!response.ok) {
        return res.status(responseStatus).json({ 
          error: "Bankful API error", 
          status: responseStatus,
          details: responseBody 
        });
      }

      try {
        const responseData = JSON.parse(responseBody);
        return res.json(responseData);
      } catch (e) {
        console.log("Response body is not JSON, returning raw text");
        return res.json({ rawResponse: responseBody });
      }
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
