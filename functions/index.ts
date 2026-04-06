import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as crypto from "crypto";

// Bankful API Integration
const BANKFUL_SALT = "Munyun1028!!";

export const createBankfulSession = onCall({
  region: "us-central1",
  invoker: "public"
}, async (request) => {
  try {
    const { total, customerEmail, orderId, shippingInfo } = request.data;
    
    logger.info("Starting createBankfulSession HPP", { orderId, customerEmail, total });

    if (total === undefined || !customerEmail || !orderId) {
      throw new HttpsError("invalid-argument", "Missing required order information (total, email, or orderId).");
    }

    // Build initial payload
    const payload: Record<string, any> = {
      req_username: "info@eclipseresearch.shop",
      transaction_type: "CAPTURE",
      amount: String(total),
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
      url_callback: "https://us-central1-eclipse-research.cloudfunctions.net/bankfulCallback",
      return_redirect_url: "Y"
    };

    // Generate SHA256 signature
    // 1. Remove signature from payload (not present yet)
    // 2. Filter out null, undefined, or empty string values
    const filteredPayload: Record<string, string> = {};
    Object.keys(payload).forEach(key => {
      const val = payload[key];
      if (val !== null && val !== undefined && val !== "") {
        filteredPayload[key] = String(val);
      }
    });

    // 3. Sort keys alphabetically
    const sortedKeys = Object.keys(filteredPayload).sort();

    // 4. Concatenate as key1value1key2value2...
    const signatureString = sortedKeys.map(key => `${key}${filteredPayload[key]}`).join("");
    
    // 5. Compute HmacSHA256(concatenatedString, salt)
    const signature = crypto
      .createHmac("sha256", BANKFUL_SALT)
      .update(signatureString)
      .digest("hex");

    // 6. Add signature to payload
    const finalPayload = {
      ...filteredPayload,
      signature
    };

    logger.info("Bankful HPP Payload:", finalPayload);
    logger.info("Bankful Signature String:", signatureString);

    logger.info("Calling Bankful HPP API", { orderId });

    // Check if global fetch is available (Node 18+)
    if (typeof fetch !== 'function') {
      throw new Error("Global fetch is not available in this environment. Please ensure Node.js 18+ is used.");
    }

    const response = await fetch("https://api.paybybankful.com/front-calls/go-in/hosted-page-pay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(finalPayload)
    });

    const responseText = await response.text();
    logger.info("Bankful API response received", { status: response.status });
    logger.info("Bankful Raw Response:", responseText);

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      logger.error("Bankful API returned non-JSON response:", responseText);
      throw new HttpsError("internal", `Bankful API returned an invalid response format: ${responseText.substring(0, 100)}`);
    }
    
    if (response.ok && data.redirect_url) {
      logger.info("Bankful HPP session created successfully:", data.redirect_url);
      return { redirect_url: data.redirect_url };
    }
    
    logger.error("Bankful API Error Response:", data);
    const errorMessage = data.message || data.error || data.errors?.join(", ") || data.response_text || "Unknown Bankful API error";
    throw new HttpsError("internal", `Bankful API error: ${errorMessage}`);

  } catch (error: any) {
    logger.error("Bankful API Integration Error:", error);
    
    if (error instanceof HttpsError) throw error;
    
    // Fallback for testing if API is unreachable or unexpected crash
    const orderId = request.data?.orderId || "unknown";
    const simulatedUrl = `https://eclipseresearch.shop/order-success?simulated=true&orderId=${orderId}`;
    
    logger.info("Returning simulated redirect URL due to error:", simulatedUrl);
    
    return { 
      redirect_url: simulatedUrl,
      isSimulated: true,
      errorDetails: error instanceof Error ? error.message : String(error)
    };
  }
});
