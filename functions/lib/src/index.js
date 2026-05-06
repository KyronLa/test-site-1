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
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderStatus = exports.createBankfulSession = void 0;
const https_1 = require("firebase-functions/v2/https");
const crypto = __importStar(require("crypto"));
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
exports.createBankfulSession = (0, https_1.onRequest)({ cors: true, invoker: "public" }, async (req, res) => {
    const { total, customerEmail, orderId, shippingInfo, cart } = req.body;
    if (orderId) {
        try {
            await db.collection("orders").doc(orderId).set({
                orderId,
                customerName: `${(shippingInfo === null || shippingInfo === void 0 ? void 0 : shippingInfo.firstName) || ""} ${(shippingInfo === null || shippingInfo === void 0 ? void 0 : shippingInfo.lastName) || ""}`.trim(),
                customerEmail: customerEmail || "",
                shippingAddress: `${(shippingInfo === null || shippingInfo === void 0 ? void 0 : shippingInfo.address) || ""}, ${(shippingInfo === null || shippingInfo === void 0 ? void 0 : shippingInfo.city) || ""}, ${(shippingInfo === null || shippingInfo === void 0 ? void 0 : shippingInfo.state) || ""} ${(shippingInfo === null || shippingInfo === void 0 ? void 0 : shippingInfo.zip) || ""}`,
                items: cart || [],
                total: Number(total),
                status: "pending",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            logger.info("Order saved to Firestore", orderId);
        }
        catch (err) {
            logger.error("Failed to save order", err);
        }
    }
    const payload = {
        req_username: "info@eclipseresearch.shop",
        transaction_type: "CAPTURE",
        amount: Number(total).toFixed(2),
        request_currency: "USD",
        cust_email: customerEmail || "",
        cust_fname: (shippingInfo === null || shippingInfo === void 0 ? void 0 : shippingInfo.firstName) || "",
        cust_lname: (shippingInfo === null || shippingInfo === void 0 ? void 0 : shippingInfo.lastName) || "",
        cust_phone: (shippingInfo === null || shippingInfo === void 0 ? void 0 : shippingInfo.phone) || "0000000000",
        bill_addr: (shippingInfo === null || shippingInfo === void 0 ? void 0 : shippingInfo.address) || "",
        bill_addr_city: (shippingInfo === null || shippingInfo === void 0 ? void 0 : shippingInfo.city) || "",
        bill_addr_state: (shippingInfo === null || shippingInfo === void 0 ? void 0 : shippingInfo.state) || "",
        bill_addr_zip: (shippingInfo === null || shippingInfo === void 0 ? void 0 : shippingInfo.zip) || "",
        bill_addr_country: "US",
        xtl_order_id: orderId || "000001",
        cart_name: "Hosted-Page",
        url_complete: "https://eclipseresearch.shop/order-success.html",
        url_failed: "https://eclipseresearch.shop/order-failed",
        url_cancel: "https://eclipseresearch.shop/checkout",
        url_pending: "https://eclipseresearch.shop/order-pending",
        url_callback: "https://eclipseresearch.shop/order-callback",
        return_redirect_url: "Y",
    };
    const salt = "Munyun1028!!";
    const payloadString = Object.keys(payload)
        .sort()
        .filter((k) => payload[k] !== undefined && payload[k] !== null && payload[k] !== "")
        .map((k) => `${k}${payload[k]}`)
        .join("");
    logger.info("payloadString", payloadString);
    payload.signature = crypto.createHmac("sha256", salt).update(payloadString).digest("hex");
    logger.info("signature", payload.signature);
    const bankfulRes = await fetch("https://api.paybybankful.com/front-calls/go-in/hosted-page-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const text = await bankfulRes.text();
    logger.info("Bankful response", bankfulRes.status, text);
    res.set("Access-Control-Allow-Origin", "*");
    res.status(200).send(text);
});
exports.updateOrderStatus = (0, https_1.onRequest)({ cors: true, invoker: "public" }, async (req, res) => {
    const { orderId, status } = req.body;
    if (!orderId) {
        res.status(400).json({ error: "Missing orderId" });
        return;
    }
    await db.collection("orders").doc(orderId).update({
        status: status || "paid",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(200).json({ success: true });
});
//# sourceMappingURL=index.js.map