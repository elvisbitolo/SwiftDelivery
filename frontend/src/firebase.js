import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig, hasFirebaseConfig } from "./firebaseConfig";

export const firebaseReady = hasFirebaseConfig();
export const firebaseMissingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const app = firebaseReady
  ? getApps()[0] || initializeApp(firebaseConfig)
  : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
