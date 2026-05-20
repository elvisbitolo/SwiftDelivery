const requiredEnv = [
  "MPESA_CONSUMER_KEY",
  "MPESA_CONSUMER_SECRET",
  "MPESA_PASSKEY",
  "MPESA_SHORTCODE",
  "MPESA_CALLBACK_URL",
];

const b2cRequiredEnv = [
  "MPESA_B2C_SHORTCODE",
  "MPESA_B2C_SECURITY_CREDENTIAL",
  "MPESA_B2C_INITIATOR_NAME",
];

const baseUrls = {
  sandbox: "https://sandbox.safaricom.co.ke",
  live: "https://api.safaricom.co.ke",
};

export function mpesaIsConfigured() {
  return requiredEnv.every((key) => Boolean(process.env[key]));
}

export function b2cIsConfigured() {
  return b2cRequiredEnv.every((key) => Boolean(process.env[key]));
}

export function mpesaReceiver() {
  return {
    name: process.env.MPESA_RECEIVER_NAME || "Delivery Kenya",
    number: process.env.MPESA_SHORTCODE || "",
  };
}

function baseUrl() {
  return baseUrls[process.env.MPESA_ENV || "sandbox"] || baseUrls.sandbox;
}

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

export function normalizeMpesaPhone(phoneNumber) {
  const digits = String(phoneNumber || "").replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if ((digits.startsWith("7") || digits.startsWith("1")) && digits.length === 9) return `254${digits}`;
  return "";
}

async function getAccessToken() {
  const credentials = Buffer
    .from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`)
    .toString("base64");

  const response = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  const body = await response.json();
  if (!response.ok || !body.access_token) {
    throw new Error(body.errorMessage || body.error || "Could not get M-Pesa access token");
  }
  return body.access_token;
}

export async function createMpesaPaymentRequest(payment) {
  // Simulation mode if credentials not configured
  if (!mpesaIsConfigured()) {
    const phoneNumber = normalizeMpesaPhone(payment.phoneNumber) || payment.phoneNumber;
    return {
      enabled: true,
      status: "mpesa_stk_sent",
      message: "SIMULATION MODE: M-Pesa STK Push simulated successfully. Check your phone and enter your M-Pesa PIN.",
      merchantRequestId: `SIM-${Date.now()}`,
      checkoutRequestId: `SIM-${Date.now()}`,
      responseCode: "0",
      responseDescription: "Success. Request accepted for processing",
      customerMessage: "Success. Request accepted for processing",
      phoneNumber,
      amount: Math.max(1, Math.round(Number(payment.amount))),
      receiver: mpesaReceiver(),
      simulation: true,
    };
  }

  const phoneNumber = normalizeMpesaPhone(payment.phoneNumber);
  if (!phoneNumber) {
    return {
      enabled: false,
      status: "mpesa_invalid_phone",
      message: "Enter a valid Safaricom phone number such as 0712345678 or +254712345678.",
      receiver: mpesaReceiver(),
    };
  }

  const amount = Math.max(1, Math.round(Number(payment.amount)));
  const requestTimestamp = timestamp();
  const password = Buffer
    .from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${requestTimestamp}`)
    .toString("base64");
  const accessToken = await getAccessToken();

  const response = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: requestTimestamp,
      TransactionType: process.env.MPESA_TRANSACTION_TYPE || "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phoneNumber,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: phoneNumber,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: payment.reference || "DeliveryKenya",
      TransactionDesc: payment.description || "Delivery payment",
    }),
  });

  const body = await response.json();
  if (!response.ok || body.ResponseCode !== "0") {
    return {
      enabled: true,
      status: "mpesa_failed_to_send",
      message: body.errorMessage || body.ResponseDescription || "M-Pesa STK Push could not be sent.",
      response: body,
      phoneNumber,
      receiver: mpesaReceiver(),
    };
  }

  return {
    enabled: true,
    status: "mpesa_stk_sent",
    message: body.CustomerMessage || "STK Push sent. Check your phone and enter your M-Pesa PIN.",
    merchantRequestId: body.MerchantRequestID,
    checkoutRequestId: body.CheckoutRequestID,
    responseCode: body.ResponseCode,
    responseDescription: body.ResponseDescription,
    customerMessage: body.CustomerMessage,
    phoneNumber,
    amount,
    receiver: mpesaReceiver(),
  };
}

export function parseMpesaCallback(body) {
  const callback = body?.Body?.stkCallback;
  const metadata = callback?.CallbackMetadata?.Item || [];
  const metadataValue = (name) => metadata.find((item) => item.Name === name)?.Value;

  return {
    merchantRequestId: callback?.MerchantRequestID,
    checkoutRequestId: callback?.CheckoutRequestID,
    resultCode: callback?.ResultCode,
    resultDescription: callback?.ResultDesc,
    receiptNumber: metadataValue("MpesaReceiptNumber") || null,
    amount: metadataValue("Amount") || null,
    phoneNumber: metadataValue("PhoneNumber") || null,
    transactionDate: metadataValue("TransactionDate") || null,
    status: callback?.ResultCode === 0 ? "mpesa_paid" : "mpesa_failed",
  };
}

export async function sendB2CPayment({ amount, phoneNumber, remarks = "Delivery payment" }) {
  // Simulation mode if B2C credentials not configured
  if (!b2cIsConfigured()) {
    const normalizedPhone = normalizeMpesaPhone(phoneNumber) || phoneNumber;
    return {
      enabled: true,
      status: "mpesa_b2c_sent",
      message: "SIMULATION MODE: B2C payment simulated successfully. Driver would receive KES " + amount + " on phone " + normalizedPhone,
      conversationId: `SIM-B2C-${Date.now()}`,
      originatorConversationId: `SIM-B2C-${Date.now()}`,
      responseCode: "0",
      responseDescription: "Success. Request accepted for processing",
      phoneNumber: normalizedPhone,
      amount: Math.max(1, Math.round(Number(amount))),
      simulation: true,
    };
  }

  const normalizedPhone = normalizeMpesaPhone(phoneNumber);
  if (!normalizedPhone) {
    return {
      enabled: false,
      status: "mpesa_invalid_phone",
      message: "Enter a valid Safaricom phone number such as 0712345678 or +254712345678.",
    };
  }

  const accessToken = await getAccessToken();
  const b2cTimestamp = timestamp();
  
  const response = await fetch(`${baseUrl()}/mpesa/b2c/v1/paymentrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      InitiatorName: process.env.MPESA_B2C_INITIATOR_NAME,
      SecurityCredential: process.env.MPESA_B2C_SECURITY_CREDENTIAL,
      CommandID: "BusinessPayment",
      Amount: Math.max(1, Math.round(Number(amount))),
      PartyA: process.env.MPESA_B2C_SHORTCODE,
      PartyB: normalizedPhone,
      Remarks: remarks,
      QueueTimeOutURL: process.env.MPESA_CALLBACK_URL,
      ResultURL: process.env.MPESA_CALLBACK_URL,
      Occasion: "DeliveryPayment",
    }),
  });

  const body = await response.json();
  if (!response.ok || body.ResponseCode !== "0") {
    return {
      enabled: true,
      status: "mpesa_b2c_failed",
      message: body.errorMessage || body.ResponseDescription || "B2C payment could not be processed.",
      response: body,
      phoneNumber: normalizedPhone,
    };
  }

  return {
    enabled: true,
    status: "mpesa_b2c_sent",
    message: "B2C payment request sent successfully.",
    conversationId: body.ConversationID,
    originatorConversationId: body.OriginatorConversationID,
    responseCode: body.ResponseCode,
    responseDescription: body.ResponseDescription,
    phoneNumber: normalizedPhone,
    amount: Math.max(1, Math.round(Number(amount))),
  };
}
