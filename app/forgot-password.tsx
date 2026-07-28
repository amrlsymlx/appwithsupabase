import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import React, { useState } from "react";
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
import { supabase, SUPABASE_CONFIGURED } from "../lib/supabase";
import { useTheme } from "../lib/theme";

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

const validateEmail = (email: string) => /\S+@\S+\.\S+/.test(email.trim());

export default function ForgotPassword() {
  const router = useRouter();
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaChallenge, setCaptchaChallenge] = useState<CaptchaChallenge>(
    () => createCaptchaChallenge(),
  );
  const [captchaInput, setCaptchaInput] = useState("");

  const emailError = emailTouched && !validateEmail(email);
  const normalizedCaptchaInput = captchaInput.trim().toLowerCase();
  const isCaptchaCorrect =
    normalizedCaptchaInput.length > 0 &&
    normalizedCaptchaInput === captchaChallenge.text;
  const canSendResetEmail =
    validateEmail(email) && isCaptchaCorrect && !loading && SUPABASE_CONFIGURED;

  const refreshCaptcha = () => {
    setCaptchaInput("");
    setCaptchaChallenge(createCaptchaChallenge());
  };

  const handleSendResetEmail = async () => {
    setEmailTouched(true);
    setStatus("");

    const normalizedEmail = email.trim();
    if (!validateEmail(normalizedEmail)) {
      setStatus("Please enter a valid email address.");
      return;
    }
    if (!isCaptchaCorrect) {
      setStatus("Captcha answer is incorrect.");
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
                onChangeText={(value) => {
                  setCaptchaInput(value);
                  if (status) setStatus("");
                }}
                autoCapitalize="characters"
              />
              {captchaInput.trim().length > 0 && !isCaptchaCorrect ? (
                <Text style={styles.fieldError}>Captcha answer is incorrect.</Text>
              ) : null}
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
});
