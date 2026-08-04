import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
import { deleteItem, getItem, setItem } from "../lib/storage";
import { supabase, SUPABASE_CONFIGURED } from "../lib/supabase";
import { useTheme } from "../lib/theme";

type RecoveryParams = {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenHash: string | null;
  recoveryType: string | null;
};

const extractRecoveryParams = (rawUrl: string): RecoveryParams => {
  const queryParams = new URLSearchParams();
  const hashParams = new URLSearchParams();

  const questionMarkIndex = rawUrl.indexOf("?");
  const hashIndex = rawUrl.indexOf("#");

  if (questionMarkIndex !== -1) {
    const queryString =
      hashIndex !== -1
        ? rawUrl.slice(questionMarkIndex + 1, hashIndex)
        : rawUrl.slice(questionMarkIndex + 1);
    const parsedQuery = new URLSearchParams(queryString);
    parsedQuery.forEach((value, key) => queryParams.set(key, value));
  }

  if (hashIndex !== -1) {
    const parsedHash = new URLSearchParams(rawUrl.slice(hashIndex + 1));
    parsedHash.forEach((value, key) => hashParams.set(key, value));
  }

  return {
    code: queryParams.get("code"),
    accessToken:
      queryParams.get("access_token") ?? hashParams.get("access_token"),
    refreshToken:
      queryParams.get("refresh_token") ?? hashParams.get("refresh_token"),
    tokenHash: queryParams.get("token_hash") ?? hashParams.get("token_hash"),
    recoveryType: queryParams.get("type") ?? hashParams.get("type"),
  };
};

const validatePassword = (password: string) => {
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialCharacter = /[!@#$%^&*()\-_+=\[\]{}:;,.?/]/.test(password);

  return (
    password.length >= 6 &&
    hasUppercase &&
    hasLowercase &&
    hasNumber &&
    hasSpecialCharacter
  );
};

const RECAPTCHA_SITE_KEY = process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY || "";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const RECAPTCHA_BASE_URL_RAW =
  process.env.EXPO_PUBLIC_RECAPTCHA_BASE_URL ||
  SUPABASE_URL ||
  "https://localhost";
const RECAPTCHA_BASE_URL = RECAPTCHA_BASE_URL_RAW.trim().replace(
  /^['\"]|['\"]$/g,
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
    <script npxsrc="https://www.google.com/recaptcha/api.js" async defer></script>
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

const CONSUMED_RECOVERY_LINK_KEY_PREFIX = "consumed_recovery_link:";
const DEFAULT_RECOVERY_LINK_BLOCK_HOURS = 24;
const configuredRecoveryLinkBlockHours = Number(
  process.env.EXPO_PUBLIC_RECOVERY_LINK_BLOCK_HOURS,
);
const recoveryLinkBlockHours =
  Number.isFinite(configuredRecoveryLinkBlockHours) &&
  configuredRecoveryLinkBlockHours > 0
    ? configuredRecoveryLinkBlockHours
    : DEFAULT_RECOVERY_LINK_BLOCK_HOURS;
const CONSUMED_RECOVERY_LINK_WINDOW_MS =
  recoveryLinkBlockHours * 60 * 60 * 1000;

type ConsumedRecoveryLinkMarker = {
  consumedAt: number;
};

const parseConsumedRecoveryMarker = (
  value: string | null,
): ConsumedRecoveryLinkMarker | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as {
      consumedAt?: unknown;
    };

    if (
      typeof parsed.consumedAt === "number" &&
      Number.isFinite(parsed.consumedAt)
    ) {
      return {
        consumedAt: parsed.consumedAt,
      };
    }
  } catch {
    return null;
  }

  return null;
};

const getRecoveryLinkFingerprint = ({
  code,
  accessToken,
  refreshToken,
  tokenHash,
}: RecoveryParams) => {
  if (code) {
    return `code:${code}`;
  }

  if (accessToken && refreshToken) {
    return `token:${accessToken}:${refreshToken}`;
  }

  if (tokenHash) {
    return `token_hash:${tokenHash}`;
  }

  return null;
};

export default function ResetPassword() {
  const router = useRouter();
  const { theme } = useTheme();
  const currentUrl = Linking.useURL();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preparingSession, setPreparingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [recoveryFingerprint, setRecoveryFingerprint] = useState<string | null>(
    null,
  );
  const [showRecaptchaModal, setShowRecaptchaModal] = useState(false);
  const [recaptchaLoading, setRecaptchaLoading] = useState(true);
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const [isRecaptchaVerified, setIsRecaptchaVerified] = useState(false);

  const passwordChecks = useMemo(
    () => ({
      minLength: password.length >= 6,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialCharacter: /[!@#$%^&*()\-_+=\[\]{}:;,.?/]/.test(password),
    }),
    [password],
  );
  const passwordMeetsRules = validatePassword(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSavePassword =
    sessionReady &&
    !preparingSession &&
    !loading &&
    passwordMeetsRules &&
    passwordsMatch &&
    isRecaptchaVerified &&
    RECAPTCHA_CONFIGURED;

  useEffect(() => {
    let cancelled = false;

    const setupRecoverySession = async () => {
      if (!SUPABASE_CONFIGURED || !supabase) {
        if (!cancelled) {
          setStatus(
            "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.",
          );
          setPreparingSession(false);
        }
        return;
      }

      const initialUrl = await Linking.getInitialURL();
      const urlToParse = currentUrl ?? initialUrl;

      if (!urlToParse) {
        if (!cancelled) {
          setStatus("Open this screen from the password reset email link.");
          setPreparingSession(false);
        }
        return;
      }

      const { code, accessToken, refreshToken, tokenHash, recoveryType } =
        extractRecoveryParams(urlToParse);
      const fingerprint = getRecoveryLinkFingerprint({
        code,
        accessToken,
        refreshToken,
        tokenHash,
        recoveryType,
      });

      if (fingerprint) {
        const consumedMarkerKey = `${CONSUMED_RECOVERY_LINK_KEY_PREFIX}${fingerprint}`;
        const consumedRaw = await getItem(consumedMarkerKey);
        const consumedMarker = parseConsumedRecoveryMarker(consumedRaw);

        if (consumedMarker) {
          const isStillBlocked =
            Date.now() - consumedMarker.consumedAt <
            CONSUMED_RECOVERY_LINK_WINDOW_MS;
          if (isStillBlocked) {
            if (!cancelled) {
              setStatus(
                "This password reset link has already been used. Request a new reset link.",
              );
              setPreparingSession(false);
            }
            return;
          }

          await deleteItem(consumedMarkerKey);
        } else if (consumedRaw) {
          await deleteItem(consumedMarkerKey);
        }

        if (consumedRaw && !consumedMarker) {
          if (!cancelled) {
            setStatus(null);
          }
        }
      }

      const { data: existingSessionData } = await supabase.auth.getSession();
      if (existingSessionData.session) {
        const { data: userData } = await supabase.auth.getUser();
        if (!cancelled) {
          setRecoveryFingerprint(fingerprint);
          setUserEmail(userData.user?.email || "");
          setSessionReady(true);
          setPreparingSession(false);
          setStatus("Recovery link verified. Set your new password.");
        }
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (!cancelled) {
            setStatus(error.message || "Invalid or expired recovery link.");
            setPreparingSession(false);
          }
          return;
        }
      } else if (tokenHash && (recoveryType === "recovery" || !recoveryType)) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (error) {
          if (!cancelled) {
            setStatus(error.message || "Invalid or expired recovery link.");
            setPreparingSession(false);
          }
          return;
        }
      } else if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          if (!cancelled) {
            setStatus(error.message || "Invalid or expired recovery link.");
            setPreparingSession(false);
          }
          return;
        }
      } else {
        if (!cancelled) {
          setStatus("Password reset link is missing required credentials.");
          setPreparingSession(false);
        }
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!cancelled) {
        setRecoveryFingerprint(fingerprint);
        setUserEmail(userData.user?.email || "");
        setSessionReady(true);
        setPreparingSession(false);
        setStatus("Recovery link verified. Set your new password.");
      }
    };

    setupRecoverySession();

    return () => {
      cancelled = true;
    };
  }, [currentUrl]);

  const sendPasswordChangedEmail = async (email: string) => {
    if (!SUPABASE_CONFIGURED || !supabase || !email) {
      return;
    }

    const { error } = await supabase.functions.invoke(
      "send-password-change-success-email",
      {
        body: {
          email,
        },
      },
    );

    if (error) {
      throw error;
    }
  };

  const ensureRecoverySession = async (): Promise<{
    ok: boolean;
    message?: string;
  }> => {
    if (!SUPABASE_CONFIGURED || !supabase) {
      return {
        ok: false,
        message:
          "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.",
      };
    }

    const { data: existingSessionData } = await supabase.auth.getSession();
    if (existingSessionData.session) {
      return { ok: true };
    }

    const initialUrl = await Linking.getInitialURL();
    const urlToParse = currentUrl ?? initialUrl;

    if (!urlToParse) {
      return {
        ok: false,
        message:
          "Auth session expired. Reopen the password reset link from your email and try again.",
      };
    }

    const { code, accessToken, refreshToken, tokenHash, recoveryType } =
      extractRecoveryParams(urlToParse);

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return {
          ok: false,
          message:
            error.message ||
            "Unable to restore recovery session. Reopen the password reset link and try again.",
        };
      }
    } else if (tokenHash && (recoveryType === "recovery" || !recoveryType)) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "recovery",
      });
      if (error) {
        return {
          ok: false,
          message:
            error.message ||
            "Unable to restore recovery session. Reopen the password reset link and try again.",
        };
      }
    } else if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        return {
          ok: false,
          message:
            error.message ||
            "Unable to restore recovery session. Reopen the password reset link and try again.",
        };
      }
    } else {
      return {
        ok: false,
        message:
          "Auth session expired. Reopen the password reset link from your email and try again.",
      };
    }

    const { data: recoveredSessionData } = await supabase.auth.getSession();
    if (!recoveredSessionData.session) {
      return {
        ok: false,
        message:
          "Auth session missing. Reopen the password reset link from your email and try again.",
      };
    }

    const { data: userData } = await supabase.auth.getUser();
    setUserEmail(userData.user?.email || "");
    setSessionReady(true);

    return { ok: true };
  };

  const handleUpdatePassword = async () => {
    if (!SUPABASE_CONFIGURED || !supabase) {
      setStatus(
        "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.",
      );
      return;
    }

    if (!passwordMeetsRules) {
      setStatus(
        "Password must be at least 6 characters and include uppercase, lowercase, number, and special character.",
      );
      return;
    }

    if (!passwordsMatch) {
      setStatus("Passwords do not match.");
      return;
    }

    if (!RECAPTCHA_CONFIGURED) {
      setStatus(
        "reCAPTCHA is not configured. Add EXPO_PUBLIC_RECAPTCHA_SITE_KEY.",
      );
      return;
    }

    if (!isRecaptchaVerified || !recaptchaToken) {
      setStatus("Please complete reCAPTCHA verification.");
      return;
    }

    setLoading(true);
    setStatus(null);

    const sessionCheck = await ensureRecoverySession();
    if (!sessionCheck.ok) {
      setLoading(false);
      setStatus(
        sessionCheck.message ||
          "Auth session missing. Reopen the password reset link from your email and try again.",
      );
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      setStatus(error.message || "Unable to update password.");
      return;
    }

    try {
      await sendPasswordChangedEmail(userEmail);
    } catch {
      // Ignore email notification failures in the reset-success UX.
    }

    setLoading(false);
    if (recoveryFingerprint) {
      await setItem(
        `${CONSUMED_RECOVERY_LINK_KEY_PREFIX}${recoveryFingerprint}`,
        JSON.stringify({
          consumedAt: Date.now(),
        }),
        true,
      );
    }

    const successMessage = `Password reset is success for ${userEmail || "[email]"}, you may now close this window`;
    const finalMessage = successMessage;

    const completeSuccess = async () => {
      try {
        if (supabase) {
          await supabase.auth.signOut();
        }
      } finally {
        closeCurrentWindow();
      }
    };

    setStatus(successMessage);

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert(finalMessage);
      await completeSuccess();
      return;
    }

    Alert.alert("Password reset successful", finalMessage, [
      {
        text: "Okay",
        onPress: () => {
          void completeSuccess();
        },
      },
    ]);
  };

  const closeCurrentWindow = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.close();

      // Some browsers block closing tabs not opened via script.
      if (!window.closed) {
        router.replace("/");
      }
      return;
    }

    router.replace("/");
  };

  const handleCancelPasswordReset = () => {
    closeCurrentWindow();
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
                Reset password
              </Text>
              <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
                Set a new password for {userEmail || "[email]"}
              </Text>
            </View>

            {status ? (
              <View style={styles.statusBox}>
                <Text style={styles.statusText}>{status}</Text>
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
                placeholder="New password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!preparingSession && sessionReady}
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                accessibilityLabel={
                  showPassword ? "Hide password" : "Show password"
                }
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                disabled={preparingSession || !sessionReady}
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
                placeholder="Confirm new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                editable={!preparingSession && sessionReady}
              />
              <Pressable
                onPress={() => setShowConfirmPassword((prev) => !prev)}
                accessibilityLabel={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                disabled={preparingSession || !sessionReady}
              >
                <MaterialCommunityIcons
                  name={showConfirmPassword ? "eye-off" : "eye"}
                  size={22}
                  color={theme.text}
                />
              </Pressable>
            </View>

            {confirmPassword.length > 0 && !passwordsMatch ? (
              <Text style={styles.errorText}>Passwords do not match.</Text>
            ) : null}

            {passwordMeetsRules && passwordsMatch ? (
              <View style={styles.robotContainer}>
                {Platform.OS === "web" ? (
                  <View style={styles.webRecaptchaWrap}>
                    <Text style={[styles.robotText, { color: theme.text }]}>
                      Verify you are a human
                    </Text>
                    {RECAPTCHA_CONFIGURED ? (
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
                    ) : null}
                  </View>
                ) : (
                  <Pressable
                    onPress={() => {
                      if (RECAPTCHA_BASE_URL_MISCONFIGURED) {
                        setStatus(
                          `Invalid reCAPTCHA base URL. Set EXPO_PUBLIC_RECAPTCHA_BASE_URL to an HTTPS domain and whitelist ${RECAPTCHA_WHITELIST_DOMAIN} in Google reCAPTCHA settings.`,
                        );
                        return;
                      }
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
            ) : null}

            {!RECAPTCHA_CONFIGURED ? (
              <Text style={styles.errorText}>
                Set EXPO_PUBLIC_RECAPTCHA_SITE_KEY in .env to enable this
                action.
              </Text>
            ) : Platform.OS !== "web" && RECAPTCHA_BASE_URL_MISCONFIGURED ? (
              <Text style={styles.recaptchaHint}>
                Set EXPO_PUBLIC_RECAPTCHA_BASE_URL to an HTTPS domain and
                whitelist {RECAPTCHA_WHITELIST_DOMAIN} in Google reCAPTCHA
                settings.
              </Text>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                !canSavePassword && styles.primaryButtonDisabled,
                pressed && styles.primaryButtonPressed,
              ]}
              onPress={handleUpdatePassword}
              disabled={!canSavePassword}
            >
              <Text style={styles.primaryButtonText}>
                {loading
                  ? "Updating password..."
                  : preparingSession
                    ? "Preparing reset..."
                    : "Save new password"}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.backToSignInButton,
                pressed && styles.backToSignInButtonPressed,
              ]}
              onPress={handleCancelPasswordReset}
            >
              <Text
                style={[
                  styles.backToSignInText,
                  { color: theme.secondaryText },
                ]}
              >
                Cancel password reset
              </Text>
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
                      setStatus(null);
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
                pressed && styles.backToSignInButtonPressed,
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
  statusBox: {
    backgroundColor: "#e0f2fe",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  statusText: {
    color: "#075985",
    fontSize: 13,
    textAlign: "center",
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
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  passwordHintTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 8,
  },
  passwordHintItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  passwordHintText: {
    marginLeft: 6,
    fontSize: 12,
    color: "#334155",
  },
  passwordHintTextSuccess: {
    color: "#166534",
  },
  errorText: {
    color: "#c00",
    fontSize: 12,
    marginBottom: 8,
  },
  robotContainer: {
    marginBottom: 8,
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
  recaptchaHint: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 8,
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
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  backToSignInButton: {
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  backToSignInButtonPressed: {
    opacity: 0.6,
  },
  backToSignInText: {
    fontSize: 14,
    fontWeight: "500",
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
