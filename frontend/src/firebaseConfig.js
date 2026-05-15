export const firebaseConfig = {
  apiKey: "AIzaSyA8T1P2X7huSvV1w3VRGRM93PWvhbcqTXE",
  authDomain: "hack-14ae1.firebaseapp.com",
  projectId: "hack-14ae1",
  storageBucket: "hack-14ae1.firebasestorage.app",
  messagingSenderId: "165708034616",
  appId: "1:165708034616:web:93378611ceeb01ce6c6ccd",
  measurementId: "G-QBYZYZGV28"
};

export const hasFirebaseConfig = () => {
  return Object.values(firebaseConfig).every((value) => value);
};