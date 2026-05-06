"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitWebhook = exports.deleteUser = exports.bankfulWebhook = exports.bankfulCallback = exports.createBankfulSession = exports.generateAIContent = void 0;
const https_1 = require("firebase-functions/v2/https");
const crypto = __importStar(require("crypto"));
const admin = __importStar(require("firebase-admin"));
const genai_1 = require("@google/genai");
const node_fetch_1 = __importDefault(require("node-fetch"));
admin.initializeApp();
function sanitizeString(input) {
    if (typeof input !== 'string')
        return String(input || '');
    const rejectedPatterns = [
        /<script\b[^>]*>([\s\S]*?)<\/script>/gim,
        /\b(SELECT|DROP|INSERT|UPDATE|DELETE|UNION|TRUNCATE)\b/gim,
        /--|;|--\s*$/g,
        /\b(==|!=|<|<=|>|>=|array-contains|in|not-in|array-contains-any)\b/g
    ];
    for (const pattern of rejectedPatterns) {
        if (pattern.test(input)) {
            throw new https_1.HttpsError("invalid-argument", `Invalid input detected: Malicious patterns are not allowed in field.`);
        }
    }
    return input.replace(/<[^>]*>?/gm, '');
}
function sanitizeData(data) {
    if (typeof data === 'string') {
        return sanitizeString(data);
    }
    if (Array.isArray(data)) {
        return data.map(item => sanitizeData(item));
    }
    if (data !== null && typeof data === 'object') {
        const sanitized = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                sanitized[key] = sanitizeData(data[key]);
            }
        }
        return sanitized;
    }
    return data;
}
async function verifyToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Unauthorized: Missing or invalid Authorization header');
    }
    const idToken = authHeader.split('Bearer ')[1];
    try {
        return await admin.auth().verifyIdToken(idToken);
    }
    catch (error) {
        throw new Error('Unauthorized: Invalid ID token');
    }
}
async function verifyAdmin(req) {
    const decodedToken = await verifyToken(req);
    return decodedToken;
}
exports.generateAIContent = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const { prompt } = request.data;
    if (!prompt) {
        throw new https_1.HttpsError("invalid-argument", "The function must be called with a 'prompt' argument.");
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new https_1.HttpsError("failed-precondition", "The Gemini API key is not configured.");
    }
    try {
        const ai = new genai_1.GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-exp",
            contents: prompt
        });
        return { text: response.text };
    }
    catch (error) {
        console.error("Gemini Error:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to generate content");
    }
});
exports.createBankfulSession = (0, https_1.onCall)(async (request) => {
    try {
        const rawData = request.data;
        const totalValue = parseFloat(String(rawData.total));
        if (isNaN(totalValue)) {
            console.error("Invalid total received:", rawData.total);
            throw new https_1.HttpsError("invalid-argument", "The total amount is invalid.");
        }
        const sanitizedData = sanitizeData(rawData);
        const { customerEmail, orderId, shippingInfo } = sanitizedData;
        const payload = {
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
        const bankfulRes = await (0, node_fetch_1.default)("https://api.paybybankful.com/front-calls/go-in/hosted-page-pay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const responseText = await bankfulRes.text();
        let responseData;
        try {
            responseData = JSON.parse(responseText);
        }
        catch (e) {
            responseData = { raw: responseText };
        }
        console.log("===== BANKFUL API DEBUG START =====");
        console.log("Status Code:", bankfulRes.status);
        console.log("Raw Response Text:", responseText);
        console.log("Parsed Response Data:", JSON.stringify(responseData, null, 2));
        console.log("===== BANKFUL API DEBUG END =====");
        if (!bankfulRes.ok || responseData.status === "error") {
            const errorMsg = responseData.errorMessage || responseData.error || "Bankful session creation failed";
            throw new https_1.HttpsError("internal", errorMsg, responseData);
        }
        return { data: responseData };
    }
    catch (error) {
        console.error("Bankful Session Error:", error);
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", error.message || "Failed to create Bankful session");
    }
});
exports.bankfulCallback = (0, https_1.onRequest)({ invoker: "public" }, async (req, res) => {
    console.log("Bankful Callback Received:", JSON.stringify(req.body || req.query, null, 2));
    try {
        res.redirect("https://eclipseresearch.shop/order-success.html");
    }
    catch (error) {
        console.error("Callback Error:", error);
        res.redirect("https://eclipseresearch.shop/order-success.html");
    }
});
exports.bankfulWebhook = (0, https_1.onRequest)({ invoker: "public" }, async (req, res) => {
    console.log("Bankful Webhook Received:", JSON.stringify(req.body, null, 2));
    res.status(200).send("OK");
});
exports.deleteUser = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const { targetUid } = request.data;
    if (!targetUid) {
        throw new https_1.HttpsError("invalid-argument", "The function must be called with a 'targetUid' argument.");
    }
    if (targetUid === request.auth.uid) {
        throw new https_1.HttpsError("failed-precondition", "You cannot delete your own account from the admin dashboard.");
    }
    try {
        await admin.auth().deleteUser(targetUid);
        return { success: true, message: `User ${targetUid} has been successfully deleted.` };
    }
    catch (error) {
        console.error("Error deleting user:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to delete user");
    }
});
exports.submitWebhook = (0, https_1.onCall)(async (request) => {
    try {
        const data = request.data;
        const registrationUrl = "https://script.google.com/macros/s/AKfycbzIF_1AWjs5w38p45C2FllgN4UgS1FkcXogPuRnEtZhOzXHarmrEVDJRl1JeXDP961J4w/exec";
        const response = await (0, node_fetch_1.default)(registrationUrl, {
            method: "POST",
            body: JSON.stringify(data),
        });
        return { success: response.ok };
    }
    catch (error) {
        console.error("Webhook Error:", error);
        throw new https_1.HttpsError("internal", error.message || "Webhook failed");
    }
});
//# sourceMappingURL=index.js.map