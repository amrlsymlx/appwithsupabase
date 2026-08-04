import * as Linking from "expo-linking";

const sanitizeRedirect = (value: string) =>
  value.trim().replace(/^['"]|['"]$/g, "");

export const SIGNUP_EMAIL_REDIRECT =
  sanitizeRedirect(process.env.EXPO_PUBLIC_SIGNUP_REDIRECT_URL || "") ||
  Linking.createURL("/");
