import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAjmuDmGGRUF--md7T9un7vQgpLTLp4x3Y",
  authDomain: "test1-372014.firebaseapp.com",
  projectId: "test1-372014",
  storageBucket: "test1-372014.firebasestorage.app",
  messagingSenderId: "598006122059",
  appId: "1:598006122059:web:49cfab1596d7102964afce",
  measurementId: "G-TV1G2VXW01"
};

const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);