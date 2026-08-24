import { getApps, initializeApp } from "firebase/app";
import {
  type Analytics,
  isSupported,
  getAnalytics,
  logEvent as firebaseLogEvent,
} from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAjmuDmGGRUF--md7T9un7vQgpLTLp4x3Y",
  authDomain: "test1-372014.firebaseapp.com",
  projectId: "test1-372014",
  storageBucket: "test1-372014.firebasestorage.app",
  messagingSenderId: "598006122059",
  appId: "1:598006122059:web:49cfab1596d7102964afce",
  measurementId: "G-TV1G2VXW01",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

let analyticsInstance: Analytics | null = null;
const ready = isSupported().then((supported) => {
  if (supported) {
    analyticsInstance = getAnalytics(app);
  }
  return analyticsInstance;
});

export async function logEvent(name: string, params?: Record<string, unknown>) {
  await ready;
  if (analyticsInstance) {
    firebaseLogEvent(analyticsInstance, name, params);
  }
}

export async function logScreenView(screenName: string) {
  await logEvent("screen_view", {
    screen_name: screenName,
    screen_class: screenName,
  });
}
