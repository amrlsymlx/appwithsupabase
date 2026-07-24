import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
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
import { supabase, SUPABASE_CONFIGURED } from "../lib/supabase";
import { ThemeToggle, useTheme } from "../lib/theme";

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
  const [captchaChallenge, setCaptchaChallenge] = useState<CaptchaChallenge>(
    () => createCaptchaChallenge(),
  );
  const [captchaInput, setCaptchaInput] = useState("");
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
  const normalizedCaptchaInput = captchaInput.trim().toLowerCase();
  const isCaptchaCorrect =
    normalizedCaptchaInput.length > 0 &&
    normalizedCaptchaInput === captchaChallenge.text;
  const isFormValid =
    name.trim().length > 0 &&
    validateEmail(email) &&
    validatePassword(password) &&
    password === confirmPassword &&
    agreeToTerms &&
    isCaptchaCorrect &&
    !!SUPABASE_CONFIGURED;

  const refreshCaptcha = () => {
    setCaptchaInput("");
    setCaptchaError("");
    setCaptchaChallenge(createCaptchaChallenge());
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

    const normalizedCaptchaInput = captchaInput.trim().toLowerCase();

    if (!normalizedCaptchaInput) {
      setCaptchaError("Please solve the captcha challenge.");
      Alert.alert("Captcha required", "Please solve the captcha challenge.");
      return;
    }

    if (normalizedCaptchaInput !== captchaChallenge.text) {
      setCaptchaError("That answer was incorrect. Please try again.");
      setCaptchaInput("");
      setCaptchaChallenge(createCaptchaChallenge());
      Alert.alert(
        "Captcha incorrect",
        "That answer was incorrect. Please try again.",
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
          options: { data: { name } },
        } as any);

        if (error) {
          const fromRateLimit =
            (error as any)?.code === "over_email_send_rate_limit" ||
            (error as any)?.status === 429;
          const errorMessage = fromRateLimit
            ? "Too many registration emails sent. Please wait a moment and try again."
            : error.message || "Unable to register";
          setStatus(errorMessage);
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.alert(`Registration failed: ${errorMessage}`);
          } else {
            Alert.alert("Registration failed", errorMessage);
          }
          return;
        }

        // If an immediate session is returned store it; otherwise user must confirm via email
        // data may contain `session` (if auto sign-in) and `user`.
        if ((data as any)?.session) {
          const successMessage = "Registration Success, please log in";
          setStatus(successMessage);
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.alert(successMessage);
          } else {
            Alert.alert("Registration Success", successMessage);
          }
          router.replace("/");
        } else {
          const successMessage = "Registration Success, please log in";
          setStatus(successMessage);
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.alert(successMessage);
          } else {
            Alert.alert("Registration Success", successMessage);
          }
          router.replace("/");
        }
      } else {
        const missingConfigMessage =
          "Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in app.json.";
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
      <ThemeToggle />
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
              <Text style={[styles.title, { color: theme.text }]}>Create account</Text>
              <Text style={[styles.subtitle, { color: theme.secondaryText }]}>Join us and get started</Text>
            </View>

            {!SUPABASE_CONFIGURED ? (
              <View style={styles.banner}>
                <Text style={[styles.bannerText, { color: theme.bannerText }]}> 
                  Supabase is not configured. Add `SUPABASE_URL` and
                  `SUPABASE_ANON_KEY` to app.json before registering.
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
                  backgroundColor: theme.name === "dark" ? "rgba(17, 24, 39, 0.85)" : "rgba(255, 255, 255, 0.95)",
                  borderColor: theme.name === "dark" ? "rgba(255, 255, 255, 0.14)" : "rgba(15, 23, 42, 0.1)",
                  color: theme.name === "dark" ? "#f9fafb" : "#111827",
                },
              ]}
              placeholderTextColor={theme.name === "dark" ? "#cbd5e1" : "#6b7280"}
              placeholder="Full name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.name === "dark" ? "rgba(17, 24, 39, 0.85)" : "rgba(255, 255, 255, 0.95)",
                  borderColor: theme.name === "dark" ? "rgba(255, 255, 255, 0.14)" : "rgba(15, 23, 42, 0.1)",
                  color: theme.name === "dark" ? "#f9fafb" : "#111827",
                },
              ]}
              placeholderTextColor={theme.name === "dark" ? "#cbd5e1" : "#6b7280"}
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
                    backgroundColor: theme.name === "dark" ? "rgba(17, 24, 39, 0.85)" : "rgba(255, 255, 255, 0.95)",
                    borderColor: theme.name === "dark" ? "rgba(255, 255, 255, 0.14)" : "rgba(15, 23, 42, 0.1)",
                    color: theme.name === "dark" ? "#f9fafb" : "#111827",
                  },
                ]}
                placeholderTextColor={theme.name === "dark" ? "#cbd5e1" : "#6b7280"}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
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
                <Text style={styles.passwordHintTitle}>Password must include:</Text>
                <Text style={styles.passwordHintItem}>• At least 6 characters</Text>
                <Text style={styles.passwordHintItem}>• Uppercase letters</Text>
                <Text style={styles.passwordHintItem}>• Lowercase letters</Text>
                <Text style={styles.passwordHintItem}>• Numbers</Text>
                <Text style={styles.passwordHintItem}>
                  • Special characters: ! @ # $ % ^ & * ( ) - _ = + { } [ ] : ; , . ? /
                </Text>
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
                    backgroundColor: theme.name === "dark" ? "rgba(17, 24, 39, 0.85)" : "rgba(255, 255, 255, 0.95)",
                    borderColor: theme.name === "dark" ? "rgba(255, 255, 255, 0.14)" : "rgba(15, 23, 42, 0.1)",
                    color: theme.name === "dark" ? "#f9fafb" : "#111827",
                  },
                ]}
                placeholderTextColor={theme.name === "dark" ? "#cbd5e1" : "#6b7280"}
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
                    style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}
                  >
                    {agreeToTerms ? <Text style={styles.checkboxMark}>✓</Text> : null}
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

            <View style={styles.captchaBox}>
              <View style={styles.captchaPromptRow}>
                <Text style={[styles.captchaLabel, { color: theme.secondaryText }]}>
                  Security check
                </Text>
                <Pressable
                  onPress={refreshCaptcha}
                  accessibilityLabel="Refresh captcha"
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                >
                  <MaterialCommunityIcons
                    name="refresh"
                    size={18}
                    color={theme.accent}
                  />
                </Pressable>
              </View>
              <View style={styles.captchaImageFrame}>
                <View style={styles.captchaCanvas}>
                  {Array.from({ length: 5 }, (_, index) => {
                    const character = captchaChallenge.text[index];
                    if (!character) {
                      return null;
                    }

                    const top = 16 + Math.floor(Math.random() * 24);
                    const left = 12 + index * 34 + Math.floor(Math.random() * 6) - 3;
                    const rotation = Math.floor(Math.random() * 30) - 15;
                    const fontSize = 26 + Math.floor(Math.random() * 8);
                    const color = ["#1f2937", "#2563eb", "#dc2626", "#7c3aed", "#0f766e"][
                      Math.floor(Math.random() * 5)
                    ];

                    return (
                      <Text
                        key={`${captchaChallenge.text}-${index}`}
                        style={[
                          styles.captchaCharacter,
                          {
                            top,
                            left,
                            color,
                            fontSize,
                            transform: [{ rotate: `${rotation}deg` }],
                          },
                        ]}
                      >
                        {character.toUpperCase()}
                      </Text>
                    );
                  })}
                  {Array.from({ length: 6 }, (_, index) => {
                    const top = 8 + index * 12 + Math.floor(Math.random() * 8);
                    const left = 10 + Math.floor(Math.random() * 140);
                    const width = 60 + Math.floor(Math.random() * 90);
                    const rotation = Math.floor(Math.random() * 25) - 12;

                    return (
                      <View
                        key={`line-${index}`}
                        style={[
                          styles.captchaLine,
                          {
                            top,
                            left,
                            width,
                            transform: [{ rotate: `${rotation}deg` }],
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              </View>
              <TextInput
                style={[
                  styles.input,
                  {
                    marginBottom: 0,
                    backgroundColor: theme.name === "dark" ? "rgba(17, 24, 39, 0.85)" : "rgba(255, 255, 255, 0.95)",
                    borderColor: theme.name === "dark" ? "rgba(255, 255, 255, 0.14)" : "rgba(15, 23, 42, 0.1)",
                    color: theme.name === "dark" ? "#f9fafb" : "#111827",
                  },
                ]}
                placeholderTextColor={theme.name === "dark" ? "#cbd5e1" : "#6b7280"}
                placeholder="Enter the characters shown"
                value={captchaInput}
                onChangeText={(value) => {
                  setCaptchaInput(value.replace(/[^A-Za-z0-9]/g, "").toUpperCase());
                  if (captchaError) {
                    setCaptchaError("");
                  }
                }}
                autoCapitalize="characters"
              />
              {captchaError ? <Text style={styles.errorText}>{captchaError}</Text> : null}
            </View>

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
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalText, { color: theme.secondaryText }]}>
                By creating an account, you agree to use this app responsibly and
                comply with all applicable laws.
              </Text>
              <Text style={[styles.modalText, { color: theme.secondaryText }]}>
                You are responsible for maintaining the confidentiality of your
                account credentials and for all activities performed under your
                account.
              </Text>
              <Text style={[styles.modalText, { color: theme.secondaryText }]}>
                We may update these terms from time to time. Continued use of the
                app after updates means you accept the revised terms.
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
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    backgroundColor: "#f8fafc",
  },
  passwordHintTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  passwordHintItem: {
    fontSize: 12,
    color: "#475569",
    marginBottom: 2,
  },
  checkboxRow: {
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
    marginBottom: 6,
  },
  captchaLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  captchaImageFrame: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  captchaCanvas: {
    width: 220,
    height: 84,
    backgroundColor: "#fef3c7",
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
  },
  captchaCharacter: {
    position: "absolute",
    fontWeight: "700",
    letterSpacing: 1,
  },
  captchaLine: {
    position: "absolute",
    height: 1,
    borderTopWidth: 1,
    borderColor: "#94a3b8",
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
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
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
