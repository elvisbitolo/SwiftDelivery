import { auth } from "./firebaseAdmin.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return res.status(401).json({ error: "Missing Firebase ID token" });
  }

  try {
    req.user = await auth.verifyIdToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired Firebase ID token" });
  }
}
