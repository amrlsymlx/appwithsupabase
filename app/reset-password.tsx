import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { deleteItem, getItem, setItem } from "../lib/storage";
import { supabase, SUPABASE_CONFIGURED } from "../lib/supabase";
import { useTheme } from "../lib/theme";

type RecoveryParams = {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
};

type CaptchaChallenge = {
  text: string;
};

const createCaptchaChallenge = (): CaptchaChallenge => {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const text = Array.from({ length: 5 }, () => {
    const index = Math.floor(Math.random() * characters.length);
    return characters[index];
  }).join("");

  return {
    text: text.toLowerCase(),
  };
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
    accessToken: hashParams.get("access_token"),
    refreshToken: hashParams.get("refresh_token"),
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
}: RecoveryParams) => {
  if (code) {
    return `code:${code}`;
  }

  if (accessToken && refreshToken) {
    return `token:${accessToken}:${refreshToken}`;
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
  const [captchaChallenge, setCaptchaChallenge] = useState<CaptchaChallenge>(
    () => createCaptchaChallenge(),
  );
  const [captchaInput, setCaptchaInput] = useState("");

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
  const normalizedCaptchaInput = captchaInput.trim().toLowerCase();
  const isCaptchaCorrect =
    normalizedCaptchaInput.length > 0 &&
    normalizedCaptchaInput === captchaChallenge.text;
  const passwordMeetsRules = validatePassword(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSavePassword =
    sessionReady &&
    !preparingSession &&
    !loading &&
    passwordMeetsRules &&
    passwordsMatch &&
    isCaptchaCorrect;

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

      const { code, accessToken, refreshToken } =
        extractRecoveryParams(urlToParse);
      const fingerprint = getRecoveryLinkFingerprint({
        code,
        accessToken,
        refreshToken,
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

  const refreshCaptcha = () => {
    setCaptchaInput("");
    setCaptchaChallenge(createCaptchaChallenge());
  };

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

    if (!isCaptchaCorrect) {
      setStatus("Captcha answer is incorrect.");
      return;
    }

    setLoading(true);
    setStatus(null);

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      setStatus(error.message || "Unable to update password.");
      return;
    }

    let notificationErrorMessage = "";
    try {
      await sendPasswordChangedEmail(userEmail);
    } catch (notificationError: any) {
      notificationErrorMessage =
        notificationError?.message ||
        "Password changed, but confirmation email could not be sent.";
    }

    setLoading(false);
    if (notificationErrorMessage) {
      Alert.alert(
        "Password updated",
        `Your password has been reset successfully.\n\n${notificationErrorMessage}`,
      );
    } else {
      Alert.alert(
        "Password updated",
        "Your password has been reset successfully.",
      );
    }

    if (recoveryFingerprint) {
      await setItem(
        `${CONSUMED_RECOVERY_LINK_KEY_PREFIX}${recoveryFingerprint}`,
        JSON.stringify({
          consumedAt: Date.now(),
        }),
        true,
      );
    }

    await supabase.auth.signOut();
    router.replace("/");
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

            <View style={styles.captchaContainer}>
              <Text style={styles.captchaLabel}>Captcha challenge</Text>
              <View style={styles.captchaChallengeRow}>
                <Text style={styles.captchaValue}>
                  {captchaChallenge.text.toUpperCase()}
                </Text>
                <Pressable
                  onPress={refreshCaptcha}
                  style={({ pressed }) => [
                    styles.captchaRefreshButton,
                    pressed && styles.captchaRefreshButtonPressed,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="refresh"
                    size={16}
                    color="#0f172a"
                  />
                  <Text style={styles.captchaRefreshText}>Refresh</Text>
                </Pressable>
              </View>
              <TextInput
                style={[
                  styles.input,
                  styles.captchaInput,
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
                placeholder="Type captcha text"
                value={captchaInput}
                onChangeText={setCaptchaInput}
                autoCapitalize="characters"
                editable={!preparingSession && sessionReady}
              />
              {captchaInput.trim().length > 0 && !isCaptchaCorrect ? (
                <Text style={styles.errorText}>
                  Captcha answer is incorrect.
                </Text>
              ) : null}
            </View>

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
              onPress={() => router.replace("/")}
            >
              <Text style={[styles.backToSignInText, { color: theme.secondaryText }]}>
                Back to sign in
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
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
  captchaContainer: {
    marginBottom: 8,
  },
  captchaLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 6,
  },
  captchaChallengeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
  },
  captchaValue: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1.8,
    color: "#0f172a",
  },
  captchaRefreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#cbd5e1",
  },
  captchaRefreshButtonPressed: {
    opacity: 0.8,
  },
  captchaRefreshText: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "600",
  },
  captchaInput: {
    marginBottom: 6,
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
});
