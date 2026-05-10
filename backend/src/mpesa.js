const requiredEnv = [
  "MPESA_CONSUMER_KEY",
  "MPESA_CONSUMER_SECRET",
  "MPESA_PASSKEY",
  "MPESA_SHORTCODE",
  "MPESA_CALLBACK_URL",
];

export function mpesaIsConfigured() {
  return requiredEnv.every((key) => Boolean(process.env[key]));
}

export async function createMpesaPaymentRequest(payment) {
  if (!mpesaIsConfigured()) {
    return {
      enabled: false,
      status: "mpesa_pending_setup",
      message: "M-Pesa is not connected yet. Add Daraja credentials to enable STK Push.",
    };
  }

  return {
    enabled: true,
    status: "mpesa_pending",
    message: "M-Pesa credentials are present. STK Push wiring can be completed when you share the Daraja details.",
    amount: payment.amount,
  };
}
