import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { db, FieldValue } from "./firebaseAdmin.js";
import { requireAuth } from "./middleware.js";
import { sendSignupNotification } from "./email.js";
import { createMpesaPaymentRequest, mpesaReceiver, parseMpesaCallback, sendB2CPayment } from "./mpesa.js";

const app = express();
const port = process.env.PORT || 4000;
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(helmet());
app.use(cors({ origin: frontendOrigin }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "delivery-kenya-backend" });
});

app.get("/api/me", requireAuth, async (req, res) => {
  const snapshot = await db.collection("users").doc(req.user.uid).get();
  if (!snapshot.exists) return res.status(404).json({ error: "Profile not found" });
  return res.json({ id: snapshot.id, ...snapshot.data() });
});

app.patch("/api/me", requireAuth, async (req, res) => {
  const allowed = ["name", "phone", "county", "languages", "isAvailable", "location"];
  const changes = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) changes[key] = req.body[key];
  }
  changes.updatedAt = FieldValue.serverTimestamp();
  await db.collection("users").doc(req.user.uid).set(changes, { merge: true });
  return res.json({ ok: true });
});

app.get("/api/people", requireAuth, async (req, res) => {
  const { role } = req.query;
  if (!["seller", "driver"].includes(role)) {
    return res.status(400).json({ error: "role must be seller or driver" });
  }

  const snapshot = await db
    .collection("users")
    .where("role", "==", role)
    .where("isAvailable", "==", true)
    .limit(100)
    .get();

  return res.json(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
});

app.post("/api/conversations", requireAuth, async (req, res) => {
  const { otherUserId } = req.body;
  if (!otherUserId) return res.status(400).json({ error: "otherUserId is required" });

  const participantIds = [req.user.uid, otherUserId].sort();
  const id = participantIds.join("_");
  await db.collection("conversations").doc(id).set(
    {
      id,
      participantIds,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return res.status(201).json({ id });
});

app.post("/api/signup-notification", requireAuth, async (req, res) => {
  const userRef = db.collection("users").doc(req.user.uid);
  const snapshot = await userRef.get();
  const profile = snapshot.exists ? snapshot.data() : {};
  const to = req.user.email || profile.email;

  if (!to) {
    return res.status(400).json({ error: "Signed-in user does not have an email address" });
  }

  if (profile.signupEmailSentAt) {
    return res.json({ skipped: true, reason: "Signup email already sent" });
  }

  const result = await sendSignupNotification({
    to,
    name: profile.name || req.body.name,
    role: profile.role || req.body.role,
  });

  if (result.sent) {
    await userRef.set({ signupEmailSentAt: FieldValue.serverTimestamp() }, { merge: true });
  }

  return res.status(201).json(result);
});

app.post("/api/payments", requireAuth, async (req, res) => {
  const { conversationId, sellerId, driverId, item, amount, method, phoneNumber, driverPhoneNumber, reference } = req.body;
  if (!conversationId || !sellerId || !driverId || !item || !amount || !["cash", "mpesa"].includes(method)) {
    return res.status(400).json({ error: "Missing or invalid payment details" });
  }

  const mpesa = method === "mpesa"
    ? await createMpesaPaymentRequest({
        amount: Number(amount),
        phoneNumber,
        reference: reference || "DeliveryKenya",
        description: item,
      })
    : null;

  let b2c = null;
  if (method === "mpesa" && mpesa?.status === "mpesa_stk_sent" && driverPhoneNumber) {
    b2c = await sendB2CPayment({
      amount: Number(amount),
      phoneNumber: driverPhoneNumber,
      remarks: `Delivery payment for ${item}`,
    });
    if (!b2c.enabled) {
      // B2C not configured, but STK push succeeded
      // Payment will be recorded as pending manual driver payment
    }
  }

  const payment = {
    conversationId,
    sellerId,
    driverId,
    item,
    amount: Number(amount),
    method,
    phoneNumber: method === "mpesa" ? mpesa?.phoneNumber || phoneNumber || null : null,
    driverPhoneNumber: method === "mpesa" ? driverPhoneNumber || null : null,
    receiver: method === "mpesa" ? mpesa?.receiver || mpesaReceiver() : null,
    reference: reference || null,
    requestedBy: req.user.uid,
    status: method === "cash" ? "cash_recorded" : (b2c?.status || mpesa.status),
    mpesa,
    b2c,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const ref = await db.collection("payments").add(payment);
  if (method === "mpesa" && mpesa?.status !== "mpesa_stk_sent") {
    return res.status(400).json({
      id: ref.id,
      ...payment,
      error: mpesa?.message || "M-Pesa request failed",
      mpesaMessage: mpesa?.message || null,
    });
  }

  return res.status(201).json({
    id: ref.id,
    ...payment,
    mpesaMessage: mpesa?.message || null,
    b2cMessage: b2c?.message || null,
  });
});

app.post("/api/mpesa/callback", async (req, res) => {
  const result = parseMpesaCallback(req.body);

  if (!result.checkoutRequestId) {
    await db.collection("mpesaCallbacks").add({
      raw: req.body,
      status: "unmatched",
      createdAt: FieldValue.serverTimestamp(),
    });
    return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  const snapshot = await db
    .collection("payments")
    .where("mpesa.checkoutRequestId", "==", result.checkoutRequestId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    await db.collection("mpesaCallbacks").add({
      ...result,
      raw: req.body,
      status: "unmatched",
      createdAt: FieldValue.serverTimestamp(),
    });
    return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  const paymentRef = snapshot.docs[0].ref;
  await paymentRef.set({
    status: result.status,
    mpesaResult: result,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

app.listen(port, () => {
  console.log(`Delivery Kenya backend running on http://localhost:${port}`);
});
