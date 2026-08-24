import { getApp } from "@react-native-firebase/app";
import { getAnalytics, logEvent as firebaseLogEvent } from "@react-native-firebase/analytics";

const analyticsInstance = getAnalytics(getApp());

export function logEvent(name: string, params?: Record<string, unknown>) {
  firebaseLogEvent(analyticsInstance, name, params);
}

export function logScreenView(screenName: string) {
  logEvent("screen_view", { screen_name: screenName, screen_class: screenName });
}
