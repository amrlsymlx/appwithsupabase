import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import RecaptchaWidget from "react-google-recaptcha";
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
import { WebView } from "react-native-webview";
import { SIGNUP_EMAIL_REDIRECT } from "../lib/authRedirect";
import { supabase, SUPABASE_CONFIGURED } from "../lib/supabase";
import { useTheme } from "../lib/theme";

const RECAPTCHA_SITE_KEY = process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY || "";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const RECAPTCHA_BASE_URL_RAW =
  process.env.EXPO_PUBLIC_RECAPTCHA_BASE_URL ||
  SUPABASE_URL ||
  "https://localhost";
const RECAPTCHA_BASE_URL = RECAPTCHA_BASE_URL_RAW.trim().replace(
  /^['"]|['"]$/g,
  "",
);
const RECAPTCHA_CONFIGURED = RECAPTCHA_SITE_KEY.length > 0;
const RECAPTCHA_WHITELIST_DOMAIN = RECAPTCHA_BASE_URL.replace(
  /^https?:\/\//i,
  "",
)
  .split("/")[0]
  .toLowerCase();
const RECAPTCHA_BASE_URL_MISCONFIGURED =
  !/^https:\/\//i.test(RECAPTCHA_BASE_URL) ||
  RECAPTCHA_WHITELIST_DOMAIN.length === 0;

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

export default function SignUp() {
  const router = useRouter();
  const { theme } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const [isRecaptchaVerified, setIsRecaptchaVerified] = useState(false);
  const [showRecaptchaModal, setShowRecaptchaModal] = useState(false);
  const [recaptchaLoading, setRecaptchaLoading] = useState(true);
  const [captchaError, setCaptchaError] = useState("");

  const validateEmail = (e: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  const validatePassword = (p: string) => {
    const hasUppercase = /[A-Z]/.test(p);
    const hasLowercase = /[a-z]/.test(p);
    const hasNumber = /[0-9]/.test(p);
    const hasSpecialCharacter = /[!@#$%^&*()\-_+=\[\]{}:;,.?/]/.test(p);

    return (
      p.length >= 6 &&
      hasUppercase &&
      hasLowercase &&
      hasNumber &&
      hasSpecialCharacter
    );
  };
  const passwordChecks = {
    minLength: password.length >= 6,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialCharacter: /[!@#$%^&*()\-_+=\[\]{}:;,.?/]/.test(password),
  };
  const isFormValid =
    name.trim().length > 0 &&
    validateEmail(email) &&
    validatePassword(password) &&
    password === confirmPassword &&
    agreeToTerms &&
    isRecaptchaVerified &&
    RECAPTCHA_CONFIGURED &&
    !!SUPABASE_CONFIGURED;

  const isExistingUserError = (error: any) => {
    const code = String(error?.code ?? "").toLowerCase();
    const message = String(error?.message ?? "").toLowerCase();

    return (
      code.includes("user_already_exists") ||
      code.includes("email_exists") ||
      code.includes("duplicate") ||
      code.includes("already_registered") ||
      message.includes("already registered") ||
      message.includes("already exists") ||
      message.includes("already in use") ||
      message.includes("duplicate")
    );
  };

  const isExistingUserFromSignUpData = (data: any, normalizedEmail: string) => {
    const user = data?.user;
    if (!user || data?.session) {
      return false;
    }

    const userEmail = String(user?.email ?? "")
      .trim()
      .toLowerCase();
    const requestedEmail = normalizedEmail.trim().toLowerCase();
    const identities = Array.isArray(user?.identities) ? user.identities : null;

    // Supabase may return a masked user-like payload for existing emails
    // when email confirmation is enabled, with no identities attached.
    return (
      userEmail === requestedEmail &&
      identities !== null &&
      identities.length === 0
    );
  };

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert("Missing fields", "Please fill all fields to register.");
      return;
    }

    const normalizedEmail = email.trim();
    if (!validateEmail(normalizedEmail)) {
      Alert.alert("Invalid email", "Enter a valid email address.");
      return;
    }
    if (!validatePassword(password)) {
      Alert.alert(
        "Weak password",
        "Password must be at least 6 characters and include uppercase, lowercase, numbers, and special characters.",
      );
      return;
    }
    if (!agreeToTerms) {
      Alert.alert(
        "Terms required",
        "You must agree to the Terms and Conditions to sign up.",
      );
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(
        "Passwords do not match",
        "Please re-enter the same password twice.",
      );
      return;
    }

    if (!RECAPTCHA_CONFIGURED) {
      setCaptchaError(
        "reCAPTCHA is not configured. Add EXPO_PUBLIC_RECAPTCHA_SITE_KEY.",
      );
      Alert.alert(
        "reCAPTCHA not configured",
        "Add EXPO_PUBLIC_RECAPTCHA_SITE_KEY to enable verification.",
      );
      return;
    }

    if (!isRecaptchaVerified || !recaptchaToken) {
      setCaptchaError("Please complete the reCAPTCHA verification.");
      Alert.alert(
        "reCAPTCHA required",
        "Please complete the reCAPTCHA verification.",
      );
      return;
    }

    setCaptchaError("");
    setLoading(true);
    setStatus(null);
    try {
      if (SUPABASE_CONFIGURED && supabase) {
        // Use Supabase Auth to create the user
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: SIGNUP_EMAIL_REDIRECT,
            data: {
              name,
              username: normalizedEmail.split("@")[0],
              role: "user",
              phoneNumber: "N/A",
              address: "N/A",
              avatarUri: null,
              avatarLibraryKey: null,
            },
          },
        } as any);

        if (error) {
          const fromRateLimit =
            (error as any)?.code === "over_email_send_rate_limit" ||
            (error as any)?.status === 429;
          const duplicateEmail = isExistingUserError(error);
          const errorMessage = fromRateLimit
            ? "Too many registration emails sent. Please wait a moment and try again."
            : duplicateEmail
              ? "An account with this email already exists. Please sign in instead."
              : error.message || "Unable to register";
          setStatus(errorMessage);
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.alert(`Registration failed: ${errorMessage}`);
          } else {
            Alert.alert(
              duplicateEmail
                ? "Email already registered"
                : "Registration failed",
              errorMessage,
            );
          }
          return;
        }

        if (isExistingUserFromSignUpData(data, normalizedEmail)) {
          const duplicateMessage =
            "An account with this email already exists. Please sign in instead.";
          setStatus(duplicateMessage);
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.alert(`Registration failed: ${duplicateMessage}`);
          } else {
            Alert.alert("Email already registered", duplicateMessage);
          }
          return;
        }

        const createdUser = Boolean(
          (data as any)?.user || (data as any)?.session,
        );
        if (createdUser) {
          const successMessage =
            "Registration Success, please check your mailbox and verify your email before signing in";
          setStatus(successMessage);
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.alert(successMessage);
          } else {
            Alert.alert("Registration Success", successMessage);
          }
          router.replace("/");
        } else {
          const fallbackErrorMessage =
            "We could not create your account. The email may already be registered or the request could not be completed.";
          setStatus(fallbackErrorMessage);
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.alert(`Registration failed: ${fallbackErrorMessage}`);
          } else {
            Alert.alert("Registration failed", fallbackErrorMessage);
          }
        }
      } else {
        const missingConfigMessage =
          "Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.";
        setStatus(missingConfigMessage);
        Alert.alert("Supabase not configured", missingConfigMessage);
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to save account.");
    } finally {
      setLoading(false);
    }
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
            <View style={styles.heroWrap}>
              <Text style={[styles.title, { color: theme.text }]}>
                Create account
              </Text>
              <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
                Join us and get started
              </Text>
            </View>

            {!SUPABASE_CONFIGURED ? (
              <View style={styles.banner}>
                <Text style={[styles.bannerText, { color: theme.bannerText }]}>
                  Supabase is not configured. Add `EXPO_PUBLIC_SUPABASE_URL` and
                  `EXPO_PUBLIC_SUPABASE_ANON_KEY` to .env before registering.
                </Text>
              </View>
            ) : null}

            {status ? (
              <View style={styles.statusBox}>
                <Text style={styles.statusText}>{status}</Text>
              </View>
            ) : null}

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
              placeholderTextColor={
                theme.name === "dark" ? "#cbd5e1" : "#6b7280"
              }
              placeholder="Full name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

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
              placeholderTextColor={
                theme.name === "dark" ? "#cbd5e1" : "#6b7280"
              }
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {email.trim().length > 0 && !validateEmail(email.trim()) ? (
              <Text style={styles.errorText}>
                Please enter a valid email address.
              </Text>
            ) : null}

            <View style={styles.passwordRow}>
              <TextInput
                style={[
                  styles.input,
                  {
                    flex: 1,
                    marginRight: 8,
                    marginBottom: 0,
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
                placeholderTextColor={
                  theme.name === "dark" ? "#cbd5e1" : "#6b7280"
                }
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                accessibilityLabel={
                  showPassword ? "Hide password" : "Show password"
                }
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <MaterialCommunityIcons
                  name={showPassword ? "eye-off" : "eye"}
                  size={22}
                  color={theme.text}
                />
              </Pressable>
            </View>
            {password.length > 0 ? (
              <View style={styles.passwordHintBox}>
                <Text style={styles.passwordHintTitle}>
                  Password must include:
                </Text>
                <View style={styles.passwordHintItem}>
                  <MaterialCommunityIcons
                    name={
                      passwordChecks.minLength
                        ? "check-circle"
                        : "circle-outline"
                    }
                    size={14}
                    color={passwordChecks.minLength ? "#16a34a" : "#64748b"}
                  />
                  <Text
                    style={[
                      styles.passwordHintText,
                      passwordChecks.minLength &&
                        styles.passwordHintTextSuccess,
                    ]}
                  >
                    At least 6 characters
                  </Text>
                </View>
                <View style={styles.passwordHintItem}>
                  <MaterialCommunityIcons
                    name={
                      passwordChecks.hasUppercase
                        ? "check-circle"
                        : "circle-outline"
                    }
                    size={14}
                    color={passwordChecks.hasUppercase ? "#16a34a" : "#64748b"}
                  />
                  <Text
                    style={[
                      styles.passwordHintText,
                      passwordChecks.hasUppercase &&
                        styles.passwordHintTextSuccess,
                    ]}
                  >
                    One uppercase letter
                  </Text>
                </View>
                <View style={styles.passwordHintItem}>
                  <MaterialCommunityIcons
                    name={
                      passwordChecks.hasLowercase
                        ? "check-circle"
                        : "circle-outline"
                    }
                    size={14}
                    color={passwordChecks.hasLowercase ? "#16a34a" : "#64748b"}
                  />
                  <Text
                    style={[
                      styles.passwordHintText,
                      passwordChecks.hasLowercase &&
                        styles.passwordHintTextSuccess,
                    ]}
                  >
                    One lowercase letter
                  </Text>
                </View>
                <View style={styles.passwordHintItem}>
                  <MaterialCommunityIcons
                    name={
                      passwordChecks.hasNumber
                        ? "check-circle"
                        : "circle-outline"
                    }
                    size={14}
                    color={passwordChecks.hasNumber ? "#16a34a" : "#64748b"}
                  />
                  <Text
                    style={[
                      styles.passwordHintText,
                      passwordChecks.hasNumber &&
                        styles.passwordHintTextSuccess,
                    ]}
                  >
                    One number
                  </Text>
                </View>
                <View style={styles.passwordHintItem}>
                  <MaterialCommunityIcons
                    name={
                      passwordChecks.hasSpecialCharacter
                        ? "check-circle"
                        : "circle-outline"
                    }
                    size={14}
                    color={
                      passwordChecks.hasSpecialCharacter ? "#16a34a" : "#64748b"
                    }
                  />
                  <Text
                    style={[
                      styles.passwordHintText,
                      passwordChecks.hasSpecialCharacter &&
                        styles.passwordHintTextSuccess,
                    ]}
                  >
                    One special character
                  </Text>
                </View>
              </View>
            ) : null}
            <View style={styles.passwordRow}>
              <TextInput
                style={[
                  styles.input,
                  {
                    flex: 1,
                    marginRight: 8,
                    marginBottom: 0,
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
                placeholderTextColor={
                  theme.name === "dark" ? "#cbd5e1" : "#6b7280"
                }
                placeholder="Confirm password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <Pressable
                onPress={() => setShowConfirmPassword((prev) => !prev)}
                accessibilityLabel={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <MaterialCommunityIcons
                  name={showConfirmPassword ? "eye-off" : "eye"}
                  size={22}
                  color={theme.text}
                />
              </Pressable>
            </View>
            {confirmPassword.length > 0 && password !== confirmPassword ? (
              <Text style={styles.errorText}>Passwords do not match.</Text>
            ) : null}

            <View style={styles.checkboxRow}>
              <View style={styles.checkboxContainer}>
                <Pressable
                  onPress={() => setAgreeToTerms((value) => !value)}
                  style={styles.checkboxTouchTarget}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: agreeToTerms }}
                >
                  <View
                    style={[
                      styles.checkbox,
                      agreeToTerms && styles.checkboxChecked,
                    ]}
                  >
                    {agreeToTerms ? (
                      <Text style={styles.checkboxMark}>✓</Text>
                    ) : null}
                  </View>
                </Pressable>
                <Text style={[styles.checkboxLabel, { color: theme.text }]}>
                  I agree to the{" "}
                </Text>
                <Pressable onPress={() => setShowTermsModal(true)}>
                  <Text style={styles.termsLinkText}>Terms & Conditions</Text>
                </Pressable>
              </View>
            </View>

            {agreeToTerms ? (
              <View style={styles.captchaBox}>
                <View style={styles.captchaPromptRow}>
                  <Text
                    style={[
                      styles.captchaLabel,
                      { color: theme.secondaryText },
                    ]}
                  >
                    Security check
                  </Text>
                </View>
                {Platform.OS === "web" ? (
                  <View style={styles.recaptchaWidgetWrap}>
                    {RECAPTCHA_CONFIGURED ? (
                      <RecaptchaWidget
                        sitekey={RECAPTCHA_SITE_KEY}
                        onChange={(token: string | null) => {
                          setRecaptchaToken(token || "");
                          setIsRecaptchaVerified(!!token);
                          setCaptchaError("");
                        }}
                        onExpired={() => {
                          setRecaptchaToken("");
                          setIsRecaptchaVerified(false);
                          setCaptchaError(
                            "reCAPTCHA expired. Please verify again.",
                          );
                        }}
                        onErrored={() => {
                          setRecaptchaToken("");
                          setIsRecaptchaVerified(false);
                          setCaptchaError(
                            "reCAPTCHA failed. Please try again.",
                          );
                        }}
                      />
                    ) : (
                      <Text style={styles.recaptchaHintText}>
                        Add EXPO_PUBLIC_RECAPTCHA_SITE_KEY to enable
                        verification.
                      </Text>
                    )}
                  </View>
                ) : (
                  <Pressable
                    onPress={() => {
                      if (RECAPTCHA_BASE_URL_MISCONFIGURED) {
                        setCaptchaError(
                          `Invalid reCAPTCHA base URL. Set EXPO_PUBLIC_RECAPTCHA_BASE_URL to an HTTPS domain and whitelist ${RECAPTCHA_WHITELIST_DOMAIN} in Google reCAPTCHA settings.`,
                        );
                        return;
                      }
                      setRecaptchaLoading(true);
                      setShowRecaptchaModal(true);
                      setCaptchaError("");
                    }}
                    style={styles.recaptchaButton}
                  >
                    <View
                      style={[
                        styles.recaptchaCheckbox,
                        isRecaptchaVerified && styles.checkboxChecked,
                      ]}
                    >
                      {isRecaptchaVerified ? (
                        <Text style={styles.checkboxMark}>✓</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.captchaLabel, { color: theme.text }]}>
                      Verify you are a human
                    </Text>
                  </Pressable>
                )}
                {!RECAPTCHA_CONFIGURED ? (
                  <Text style={styles.recaptchaHintText}>
                    Set EXPO_PUBLIC_RECAPTCHA_SITE_KEY in .env to enable this
                    action.
                  </Text>
                ) : Platform.OS !== "web" &&
                  RECAPTCHA_BASE_URL_MISCONFIGURED ? (
                  <Text style={styles.recaptchaHintText}>
                    Set EXPO_PUBLIC_RECAPTCHA_BASE_URL to an HTTPS domain and
                    whitelist {RECAPTCHA_WHITELIST_DOMAIN} in Google reCAPTCHA
                    settings.
                  </Text>
                ) : null}
                {captchaError ? (
                  <Text style={styles.errorText}>{captchaError}</Text>
                ) : null}
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                (loading || !isFormValid) && styles.primaryButtonDisabled,
                pressed && styles.primaryButtonPressed,
              ]}
              onPress={handleRegister}
              disabled={loading || !isFormValid}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? "Creating..." : "Sign Up"}
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.replace("/")}
          >
            <Text style={styles.secondaryButtonText}>Back to Sign In</Text>
          </Pressable>
        </View>
      </ScrollView>
      <Modal
        visible={showRecaptchaModal && Platform.OS !== "web"}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRecaptchaModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.recaptchaModalCard}>
            <Text style={styles.recaptchaModalTitle}>Complete reCAPTCHA</Text>
            <View style={styles.webviewWrap}>
              <WebView
                originWhitelist={["*"]}
                javaScriptEnabled
                domStorageEnabled
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
                      setCaptchaError("");
                      return;
                    }
                    if (payload.type === "expired") {
                      setRecaptchaToken("");
                      setIsRecaptchaVerified(false);
                      setCaptchaError(
                        "reCAPTCHA expired. Please verify again.",
                      );
                      return;
                    }
                    if (payload.type === "error") {
                      setRecaptchaToken("");
                      setIsRecaptchaVerified(false);
                      setCaptchaError("reCAPTCHA failed. Please try again.");
                    }
                  } catch {
                    setRecaptchaToken("");
                    setIsRecaptchaVerified(false);
                    setCaptchaError("Unable to process reCAPTCHA result.");
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
                pressed && styles.primaryButtonPressed,
              ]}
              onPress={() => {
                setShowRecaptchaModal(false);
                setRecaptchaLoading(true);
              }}
            >
              <Text style={styles.primaryButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTermsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTermsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Terms & Conditions
            </Text>
            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.modalText, { color: theme.secondaryText }]}>
                By creating an account, you agree to use this app responsibly
                and comply with all applicable laws.
              </Text>
              <Text style={[styles.modalText, { color: theme.secondaryText }]}>
                You are responsible for maintaining the confidentiality of your
                account credentials and for all activities performed under your
                account.
              </Text>
              <Text style={[styles.modalText, { color: theme.secondaryText }]}>
                We may update these terms from time to time. Continued use of
                the app after updates means you accept the revised terms.
              </Text>
            </ScrollView>
            <Pressable
              style={({ pressed }) => [
                styles.modalCloseButton,
                pressed && styles.primaryButtonPressed,
              ]}
              onPress={() => setShowTermsModal(false)}
            >
              <Text style={styles.primaryButtonText}>Close</Text>
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
    justifyContent: "flex-start",
    padding: 24,
  },
  heroWrap: {
    alignItems: "center",
    marginBottom: 20,
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
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  passwordHintBox: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: -4,
    marginBottom: 12,
  },
  passwordHintTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1e3a8a",
    marginBottom: 4,
  },
  passwordHintItem: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  passwordHintText: {
    marginLeft: 8,
    fontSize: 12,
    color: "#475569",
  },
  passwordHintTextSuccess: {
    color: "#166534",
  },
  checkboxRow: {
    marginTop: 4,
    marginBottom: 12,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  checkboxTouchTarget: {
    marginRight: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
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
  checkboxLabel: {
    fontSize: 14,
  },
  termsLinkText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  captchaBox: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  captchaPromptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  captchaLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  recaptchaWidgetWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  recaptchaButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
  },
  recaptchaCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    marginRight: 8,
  },
  recaptchaHintText: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 6,
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
  secondaryButton: {
    marginTop: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    borderRadius: 14,
    padding: 16,
    maxHeight: "80%",
  },
  recaptchaModalCard: {
    width: "100%",
    maxWidth: 420,
    height: 360,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  recaptchaModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 10,
    textAlign: "center",
  },
  modalBody: {
    marginBottom: 12,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  modalCloseButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#2563eb",
  },
  banner: {
    backgroundColor: "#fff3cd",
    borderColor: "#ffeeba",
    borderWidth: 1,
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  bannerText: {
    fontSize: 12,
  },
  statusBox: {
    borderRadius: 6,
    backgroundColor: "#e8f4ff",
    borderWidth: 1,
    borderColor: "#b8d7f0",
    padding: 10,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    textAlign: "center",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 12,
    marginTop: 6,
    marginBottom: 4,
  },
});
