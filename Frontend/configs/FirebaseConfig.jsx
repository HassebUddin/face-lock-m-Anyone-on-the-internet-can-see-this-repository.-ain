import { initializeApp } from "firebase/app";

import { getAuth } from "firebase/auth";

import { getDatabase } from "firebase/database";

import { getStorage } from "firebase/storage"; // Import Firebase Storage


// Your web app's Firebase configuration

const firebaseConfig = {

  apiKey: "AIzaSyD3fLSeKLdB_RUheMhdyztbDuXpPVpAPKI",

  authDomain: "authenticatio0n.firebaseapp.com",

  databaseURL: "https://authenticatio0n-default-rtdb.asia-southeast1.firebasedatabase.app",

  projectId: "authenticatio0n",

  storageBucket: "authenticatio0n.appspot.com",

  messagingSenderId: "708014215750",

  appId: "1:708014215750:web:04b0577640ab187ffb7047"

};


// Initialize Firebase

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const database = getDatabase(app);

export const storage = getStorage(app); // Initialize Firebase Storage