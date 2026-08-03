import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import {
    clearRememberedCredentials,
    getRememberedCredentials,
    setAuthSession,
    setRememberedCredentials,
} from "../lib/storage";
import { supabase, SUPABASE_CONFIGURED } from "../lib/supabase";
import { useTheme } from "../lib/theme";

type EmailVerificationParams = {
  code: string | null;
  tokenHash: string | null;
  type: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  errorDescription: string | null;
};

const extractEmailVerificationParams = (
  rawUrl: string,
): EmailVerificationParams => {
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
    code: queryParams.get("code") ?? hashParams.get("code"),
    tokenHash: queryParams.get("token_hash") ?? hashParams.get("token_hash"),
    type: queryParams.get("type") ?? hashParams.get("type"),
    accessToken:
      queryParams.get("access_token") ?? hashParams.get("access_token"),
    refreshToken:
      queryParams.get("refresh_token") ?? hashParams.get("refresh_token"),
    errorDescription:
      queryParams.get("error_description") ??
      hashParams.get("error_description") ??
      queryParams.get("error") ??
      hashParams.get("error"),
  };
};

export default function Index() {
  const router = useRouter();
  const { theme } = useTheme();
  const currentUrl = Linking.useURL();
  const processedVerificationUrlRef = useRef<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  const handleLogin = async () => {
    setEmailTouched(true);
    setPasswordTouched(true);
    setError("");

    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      setError("Please fix validation errors before signing in.");
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.trim();

      if (SUPABASE_CONFIGURED && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        } as any);

        if (error) {
          setError(error.message || "Sign-in failed");
        } else {
          const userMetadata =
            (data as any)?.user?.user_metadata ||
            (data as any)?.session?.user?.user_metadata ||
            {};
          const signedInName =
            userMetadata?.name || userMetadata?.full_name || "";
          const signedInPhoneNumber =
            userMetadata?.phoneNumber || userMetadata?.phone_number || "N/A";
          const signedInAddress = userMetadata?.address || "N/A";
          const signedInUsername =
            userMetadata?.username || normalizedEmail.split("@")[0] || "N/A";
          const signedInRole = userMetadata?.role || "user";
          const signedInAvatarUri = userMetadata?.avatarUri || null;
          const signedInAvatarLibraryKey =
            userMetadata?.avatarLibraryKey || null;
          await setAuthSession(
            {
              email: normalizedEmail,
              name: signedInName,
              phoneNumber: signedInPhoneNumber,
              address: signedInAddress,
              username: signedInUsername,
              role: signedInRole,
              avatarUri: signedInAvatarUri,
              avatarLibraryKey: signedInAvatarLibraryKey,
            },
            keepSignedIn,
          );
          if (keepSignedIn) {
            await setRememberedCredentials({
              email: normalizedEmail,
              password,
            });
          } else {
            await clearRememberedCredentials();
          }
          setEmail("");
          setPassword("");
          setEmailTouched(false);
          setPasswordTouched(false);
          router.replace("/dashboard" as any);
        }
      } else {
        Alert.alert(
          "Supabase not configured",
          "Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env before signing in.",
        );
      }
    } catch (err: any) {
      setError(err?.message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (e: string) => {
    if (!e) return false;
    return /\S+@\S+\.\S+/.test(e);
  };

  const validatePassword = (p: string) => {
    if (!p) return false;
    return p.length >= 6;
  };

  const formValid = validateEmail(email) && validatePassword(password);
  const emailError = emailTouched && !validateEmail(email);

  useEffect(() => {
    const loadSession = async () => {
      const remembered = await getRememberedCredentials();
      if (remembered) {
        setEmail(remembered.email);
        setPassword(remembered.password);
        setKeepSignedIn(true);
      }

      setCheckingSession(false);
    };

    loadSession();
  }, [router]);

  useEffect(() => {
    const handleEmailVerification = async () => {
      if (!SUPABASE_CONFIGURED || !supabase) {
        return;
      }

      const initialUrl = await Linking.getInitialURL();
      const urlToParse = currentUrl ?? initialUrl;

      if (!urlToParse || processedVerificationUrlRef.current === urlToParse) {
        return;
      }

      const {
        code,
        tokenHash,
        type,
        accessToken,
        refreshToken,
        errorDescription,
      } = extractEmailVerificationParams(urlToParse);
      if (type !== "signup") {
        return;
      }

      processedVerificationUrlRef.current = urlToParse;

      let verificationError: string | null = null;

      if (errorDescription) {
        verificationError = errorDescription;
      }

      if (!verificationError && code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          verificationError = error.message || "Unable to verify email.";
        }
      } else if (!verificationError && tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "signup",
        });
        if (error) {
          verificationError = error.message || "Unable to verify email.";
        }
      } else if (!verificationError && accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          verificationError = error.message || "Unable to verify email.";
        }
      } else if (!verificationError) {
        // Some providers redirect back with type=signup but without verifiable tokens.
        // Do not show a false failure toast in that case.
        return;
      }

      if (verificationError) {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.alert(`Email verification failed: ${verificationError}`);
        } else {
          Alert.alert("Email verification failed", verificationError);
        }
        return;
      }

      await supabase.auth.signOut();

      const successMessage =
        "Email verification success, you can now login using your credential";

      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(successMessage);
      } else {
        Alert.alert("Email verified", successMessage);
      }

      router.replace("/");
    };

    void handleEmailVerification();
  }, [currentUrl, router]);

  if (checkingSession) {
    return null;
  }

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
                Welcome back
              </Text>
              <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
                Sign in to continue
              </Text>
            </View>

            {!SUPABASE_CONFIGURED ? (
              <View style={styles.banner}>
                <Text style={[styles.bannerText, { color: theme.bannerText }]}>
                  Supabase is not configured. Add `EXPO_PUBLIC_SUPABASE_URL` and
                  `EXPO_PUBLIC_SUPABASE_ANON_KEY` to .env and restart the app.
                </Text>
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
              placeholder="Email"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (error) setError("");
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
                onChangeText={(t) => {
                  setPassword(t);
                  if (error) setError("");
                }}
                onBlur={() => setPasswordTouched(true)}
                secureTextEntry={!showPassword}
              />
              <Pressable
                onPress={() => setShowPassword((s) => !s)}
                accessibilityLabel={
                  showPassword ? "Hide password" : "Show password"
                }
                style={({ pressed }) => [
                  { padding: 6, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <MaterialCommunityIcons
                  name={showPassword ? "eye-off" : "eye"}
                  size={22}
                  color={theme.text}
                />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.forgotPasswordButton,
                pressed && styles.secondaryButtonPressed,
              ]}
              onPress={() => router.push("/forgot-password")}
              disabled={!SUPABASE_CONFIGURED}
            >
              <Text style={styles.forgotPasswordButtonText}>
                Forgot password?
              </Text>
            </Pressable>

            {error ? (
              <Text style={[styles.error, { color: theme.error }]}>
                {error}
              </Text>
            ) : null}

            <View style={styles.checkboxRow}>
              <Pressable
                onPress={() => setKeepSignedIn((value) => !value)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: keepSignedIn }}
              >
                <View
                  style={[
                    styles.checkbox,
                    keepSignedIn && styles.checkboxChecked,
                  ]}
                >
                  {keepSignedIn ? (
                    <Text style={styles.checkboxMark}>✓</Text>
                  ) : null}
                </View>
              </Pressable>
              <Text style={[styles.checkboxLabel, { color: theme.text }]}>
                Remember me
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                (loading || !formValid || !SUPABASE_CONFIGURED) &&
                  styles.primaryButtonDisabled,
                pressed && styles.primaryButtonPressed,
              ]}
              onPress={handleLogin}
              disabled={loading || !formValid || !SUPABASE_CONFIGURED}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? "Signing in..." : "Sign In"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.signUpContainer}>
            <Text style={[styles.signUpText, { color: theme.text }]}>
              Don&apos;t have an account yet?{" "}
            </Text>
            <Pressable onPress={() => router.push("/sign-up")}>
              <Text style={styles.signUpLink}>Sign Up</Text>
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
  error: {
    color: "#c00",
    marginBottom: 8,
    textAlign: "center",
  },
  fieldError: {
    color: "#c00",
    fontSize: 12,
    marginBottom: 8,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 12,
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
  checkboxLabel: {
    fontSize: 14,
  },
  forgotPasswordButton: {
    alignSelf: "flex-end",
    marginTop: 10,
    marginBottom: 4,
  },
  secondaryButtonPressed: {
    opacity: 0.7,
  },
  forgotPasswordButtonText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "600",
  },
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 8,
  },
  signUpText: {
    fontSize: 14,
  },
  signUpLink: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
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
});
