import admin from "firebase-admin";

const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
// Treat the placeholder shipped in .env.example as "not configured"
const privateKey =
  rawPrivateKey && !rawPrivateKey.includes("replace_me") ? rawPrivateKey : null;

const hasServiceAccount =
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  privateKey;

if (!admin.apps.length) {
  const options = hasServiceAccount
    ? {
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      }
    : { projectId: process.env.FIREBASE_PROJECT_ID || "delivery-67faf" };

  admin.initializeApp(options);
}

export const auth = admin.auth();
export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;
