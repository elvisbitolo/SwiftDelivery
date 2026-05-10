import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { db, FieldValue } from "./firebaseAdmin.js";
import { requireAuth } from "./middleware.js";
import { createMpesaPaymentRequest } from "./mpesa.js";

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

app.post("/api/payments", requireAuth, async (req, res) => {
  const { conversationId, sellerId, driverId, item, amount, method } = req.body;
  if (!conversationId || !sellerId || !driverId || !item || !amount || !["cash", "mpesa"].includes(method)) {
    return res.status(400).json({ error: "Missing or invalid payment details" });
  }

  const mpesa = method === "mpesa"
    ? await createMpesaPaymentRequest({ amount: Number(amount) })
    : null;

  const payment = {
    conversationId,
    sellerId,
    driverId,
    item,
    amount: Number(amount),
    method,
    requestedBy: req.user.uid,
    status: method === "cash" ? "cash_on_delivery" : mpesa.status,
    mpesa,
    createdAt: FieldValue.serverTimestamp(),
  };

  const ref = await db.collection("payments").add(payment);
  return res.status(201).json({
    id: ref.id,
    ...payment,
    mpesaMessage: mpesa?.message || null,
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

app.listen(port, () => {
  console.log(`Delivery Kenya backend running on http://localhost:${port}`);
});
