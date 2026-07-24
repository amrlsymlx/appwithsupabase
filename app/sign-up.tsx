import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Button,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase, SUPABASE_CONFIGURED } from "../lib/supabase";
import { ThemeToggle, useTheme } from "../lib/theme";

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

  const validateEmail = (e: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  const validatePassword = (p: string) => p.length >= 6;
  const isFormValid =
    name.trim().length > 0 &&
    validateEmail(email) &&
    validatePassword(password) &&
    password === confirmPassword &&
    !!SUPABASE_CONFIGURED;

  const generateId = () =>
    `u_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

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
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(
        "Passwords do not match",
        "Please re-enter the same password twice.",
      );
      return;
    }

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
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background, paddingTop: 80 },
      ]}
    >
      <ThemeToggle />
      <Text style={[styles.title, { color: theme.text }]}>Sign Up</Text>

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
            backgroundColor: theme.name === "dark" ? "#1f2937" : "#ffffff",
            borderColor: theme.name === "dark" ? "#4b5563" : "#d1d5db",
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
            backgroundColor: theme.name === "dark" ? "#1f2937" : "#ffffff",
            borderColor: theme.name === "dark" ? "#4b5563" : "#d1d5db",
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
              backgroundColor: theme.name === "dark" ? "#1f2937" : "#ffffff",
              borderColor: theme.name === "dark" ? "#4b5563" : "#d1d5db",
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

      <View style={styles.passwordRow}>
        <TextInput
          style={[
            styles.input,
            {
              flex: 1,
              marginRight: 8,
              marginBottom: 0,
              backgroundColor: theme.name === "dark" ? "#1f2937" : "#ffffff",
              borderColor: theme.name === "dark" ? "#4b5563" : "#d1d5db",
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

      <View style={styles.button}>
        <Button
          title={loading ? "Creating..." : "Sign Up"}
          onPress={handleRegister}
          disabled={loading || !isFormValid}
        />
      </View>

      <Pressable
        style={styles.secondaryButton}
        onPress={() => router.replace("/")}
      >
        <Text style={styles.secondaryButtonText}>Back to Sign In</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  input: {
    height: 44,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  button: { marginTop: 8 },
  secondaryButton: {
    marginTop: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "600",
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
    marginTop: -4,
    marginBottom: 8,
  },
});
