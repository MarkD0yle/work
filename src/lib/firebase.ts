// Firebase initialization.
// Note: these values are NOT secrets — Firebase web config is public by design.
// Data is protected by Firestore security rules, not by hiding this config.
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDNIsU106KDpEGseFUFRb_3cSHLqhSrlyE",
  authDomain: "absurdalpha.firebaseapp.com",
  projectId: "absurdalpha",
  storageBucket: "absurdalpha.firebasestorage.app",
  messagingSenderId: "608070978000",
  appId: "1:608070978000:web:8cccc350fb7dcc059d51d5",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
