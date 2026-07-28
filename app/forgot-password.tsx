import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import RecaptchaWidget from "react-google-recaptcha";
import { WebView } from "react-native-webview";
import { supabase, SUPABASE_CONFIGURED } from "../lib/supabase";
import { useTheme } from "../lib/theme";

const validateEmail = (email: string) => /\S+@\S+\.\S+/.test(email.trim());
const RECAPTCHA_SITE_KEY = process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY || "";
const RECAPTCHA_BASE_URL =
  process.env.EXPO_PUBLIC_RECAPTCHA_BASE_URL || "https://localhost";
const RECAPTCHA_CONFIGURED = RECAPTCHA_SITE_KEY.length > 0;

const createRecaptchaHtml = (siteKey: string) => `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="https://www.google.com/recaptcha/api.js" async defer></script>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f8fafc;
        font-family: Arial, sans-serif;
      }
      .card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div
        class="g-recaptcha"
        data-sitekey="${siteKey}"
        data-callback="onRecaptchaVerified"
        data-expired-callback="onRecaptchaExpired"
        data-error-callback="onRecaptchaError"
      ></div>
    </div>
    <script>
      function post(payload) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
      function onRecaptchaVerified(token) {
        post({ type: "verified", token: token });
      }
      function onRecaptchaExpired() {
        post({ type: "expired" });
      }
      function onRecaptchaError() {
        post({ type: "error" });
      }
    </script>
  </body>
</html>`;

export default function ForgotPassword() {
  const router = useRouter();
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRecaptchaModal, setShowRecaptchaModal] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const [isRecaptchaVerified, setIsRecaptchaVerified] = useState(false);
  const [recaptchaLoading, setRecaptchaLoading] = useState(true);

  const emailError = emailTouched && !validateEmail(email);
  const canSendResetEmail =
    validateEmail(email) &&
    isRecaptchaVerified &&
    !loading &&
    SUPABASE_CONFIGURED &&
    RECAPTCHA_CONFIGURED;

  const handleSendResetEmail = async () => {
    setEmailTouched(true);
    setStatus("");

    const normalizedEmail = email.trim();
    if (!validateEmail(normalizedEmail)) {
      setStatus("Please enter a valid email address.");
      return;
    }
    if (!RECAPTCHA_CONFIGURED) {
      setStatus("reCAPTCHA is not configured. Add EXPO_PUBLIC_RECAPTCHA_SITE_KEY.");
      return;
    }
    if (!isRecaptchaVerified || !recaptchaToken) {
      setStatus("Please complete reCAPTCHA verification.");
      return;
    }

    if (!SUPABASE_CONFIGURED || !supabase) {
      Alert.alert(
        "Supabase not configured",
        "Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env before resetting your password.",
      );
      return;
    }

    setLoading(true);
    const redirectTo = Linking.createURL("/reset-password");
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    });
    setLoading(false);

    if (error) {
      const fromRateLimit =
        error.code === "over_email_send_rate_limit" || error.status === 429;
      setStatus(
        fromRateLimit
          ? "Too many password reset requests. Please wait a moment and try again."
          : error.message || "Failed to send reset password email.",
      );
      return;
    }

    const successMessage = `The reset password email is sent to ${normalizedEmail} if it registered with us`;
    setStatus(successMessage);
    Alert.alert("Reset password", successMessage);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.keyboardView, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.container,
            { backgroundColor: theme.background, paddingTop: 80 },
          ]}
        >
          <View
            style={[
              styles.formCard,
              {
                backgroundColor:
                  theme.name === "dark"
                    ? "rgba(31, 41, 55, 0.72)"
                    : "rgba(255, 255, 255, 0.95)",
                borderWidth: Platform.OS === "android" ? 0 : 1,
                borderColor:
                  Platform.OS === "android"
                    ? "transparent"
                    : "rgba(255, 255, 255, 0.25)",
              },
            ]}
          >
            <Text style={[styles.title, { color: theme.text }]}>Forgot password</Text>
            <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
              Enter your email to receive a reset link.
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor:
                    theme.name === "dark"
                      ? "rgba(17, 24, 39, 0.85)"
                      : "rgba(255, 255, 255, 0.95)",
                  borderColor:
                    theme.name === "dark"
                      ? "rgba(255, 255, 255, 0.14)"
                      : "rgba(15, 23, 42, 0.1)",
                  color: theme.name === "dark" ? "#f9fafb" : "#111827",
                },
              ]}
              placeholderTextColor={theme.name === "dark" ? "#cbd5e1" : "#6b7280"}
              placeholder="Email"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (status) setStatus("");
              }}
              onBlur={() => setEmailTouched(true)}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {emailError ? (
              <Text style={styles.fieldError}>
                {email ? "Enter a valid email address" : "Email is required"}
              </Text>
            ) : null}

            <View style={styles.robotContainer}>
              {Platform.OS === "web" ? (
                <View style={styles.webRecaptchaWrap}>
                  <Text style={[styles.robotText, { color: theme.text }]}>
                    Verify you are a human
                  </Text>
                  <RecaptchaWidget
                    sitekey={RECAPTCHA_SITE_KEY}
                    onChange={(token: string | null) => {
                      setRecaptchaToken(token || "");
                      setIsRecaptchaVerified(!!token);
                      if (status) setStatus("");
                    }}
                    onExpired={() => {
                      setRecaptchaToken("");
                      setIsRecaptchaVerified(false);
                      setStatus("reCAPTCHA expired. Please verify again.");
                    }}
                    onErrored={() => {
                      setRecaptchaToken("");
                      setIsRecaptchaVerified(false);
                      setStatus("reCAPTCHA failed. Please try again.");
                    }}
                  />
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    setRecaptchaLoading(true);
                    setShowRecaptchaModal(true);
                    if (status) setStatus("");
                  }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isRecaptchaVerified }}
                  style={styles.robotRow}
                >
                  <View
                    style={[
                      styles.checkbox,
                      isRecaptchaVerified && styles.checkboxChecked,
                      {
                        borderColor:
                          theme.name === "dark"
                            ? "rgba(255, 255, 255, 0.4)"
                            : "#94a3b8",
                      },
                    ]}
                  >
                    {isRecaptchaVerified ? (
                      <Text style={styles.checkboxMark}>✓</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.robotText, { color: theme.text }]}>
                    Verify you are a human
                  </Text>
                </Pressable>
              )}
            </View>

            {status ? <Text style={styles.status}>{status}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                !canSendResetEmail && styles.primaryButtonDisabled,
                pressed && styles.primaryButtonPressed,
              ]}
              onPress={handleSendResetEmail}
              disabled={!canSendResetEmail}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? "Sending..." : "Send reset email"}
              </Text>
            </Pressable>
            {!RECAPTCHA_CONFIGURED ? (
              <Text style={styles.fieldError}>
                Set EXPO_PUBLIC_RECAPTCHA_SITE_KEY in .env to enable this action.
              </Text>
            ) : Platform.OS !== "web" ? (
              <Text style={styles.recaptchaHint}>
                If you see &quot;Invalid domain for site key&quot;, set
                EXPO_PUBLIC_RECAPTCHA_BASE_URL and whitelist that domain in
                reCAPTCHA settings.
              </Text>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.secondaryButtonPressed,
              ]}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>Back to sign in</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      <Modal
        visible={showRecaptchaModal && Platform.OS !== "web"}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRecaptchaModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Complete reCAPTCHA</Text>
            <View style={styles.webviewWrap}>
              <WebView
                originWhitelist={["*"]}
                source={{
                  html: createRecaptchaHtml(RECAPTCHA_SITE_KEY),
                  baseUrl: RECAPTCHA_BASE_URL,
                }}
                onLoadEnd={() => setRecaptchaLoading(false)}
                onMessage={(event) => {
                  try {
                    const payload = JSON.parse(event.nativeEvent.data || "{}");
                    if (payload.type === "verified" && payload.token) {
                      setRecaptchaToken(payload.token);
                      setIsRecaptchaVerified(true);
                      setShowRecaptchaModal(false);
                      setStatus("");
                      return;
                    }
                    if (payload.type === "expired") {
                      setRecaptchaToken("");
                      setIsRecaptchaVerified(false);
                      setStatus("reCAPTCHA expired. Please verify again.");
                      return;
                    }
                    if (payload.type === "error") {
                      setRecaptchaToken("");
                      setIsRecaptchaVerified(false);
                      setStatus("reCAPTCHA failed. Please try again.");
                    }
                  } catch {
                    setRecaptchaToken("");
                    setIsRecaptchaVerified(false);
                    setStatus("Unable to process reCAPTCHA result.");
                  }
                }}
              />
              {recaptchaLoading ? (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="small" color="#2563eb" />
                </View>
              ) : null}
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.modalCloseButton,
                pressed && styles.secondaryButtonPressed,
              ]}
              onPress={() => {
                setShowRecaptchaModal(false);
                setRecaptchaLoading(true);
              }}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    position: "relative",
  },
  formCard: {
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    backdropFilter: "blur(12px)",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  fieldError: {
    color: "#c00",
    fontSize: 12,
    marginBottom: 8,
  },
  robotContainer: {
    marginBottom: 12,
  },
  webRecaptchaWrap: {
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  robotRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  checkboxMark: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  robotText: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "600",
  },
  status: {
    color: "#075985",
    textAlign: "center",
    marginBottom: 8,
  },
  primaryButton: {
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#2563eb",
  },
  primaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  backButton: {
    alignSelf: "center",
    marginTop: 12,
  },
  backButtonText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  secondaryButtonPressed: {
    opacity: 0.7,
  },
  recaptchaHint: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    height: 360,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 10,
    textAlign: "center",
  },
  webviewWrap: {
    flex: 1,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.75)",
  },
  modalCloseButton: {
    alignSelf: "center",
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
  },
  modalCloseText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "600",
  },
});
