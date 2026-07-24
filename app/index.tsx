import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  clearAuthSession,
  getAuthSession,
  setAuthSession,
} from "../lib/storage";
import { supabase, SUPABASE_CONFIGURED } from "../lib/supabase";
import { ThemeToggle, useTheme } from "../lib/theme";

export default function Index() {
  const router = useRouter();
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");

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
      if (SUPABASE_CONFIGURED && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        } as any);

        if (error) {
          setError(error.message || "Sign-in failed");
        } else {
          const signedInName =
            (data as any)?.user?.user_metadata?.name ||
            (data as any)?.session?.user?.user_metadata?.name ||
            "";
          await setAuthSession({ email, name: signedInName });
          setUserName(signedInName);
          setUserEmail(email);
          setIsAuthenticated(true);
          setEmail("");
          setPassword("");
          setEmailTouched(false);
          setPasswordTouched(false);
          router.replace("/");
        }
      } else {
        Alert.alert(
          "Supabase not configured",
          "Please set SUPABASE_URL and SUPABASE_ANON_KEY in app.json before signing in.",
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
  const passwordError = passwordTouched && !validatePassword(password);

  useEffect(() => {
    const loadSession = async () => {
      const session = await getAuthSession();
      if (session?.authenticated) {
        setIsAuthenticated(true);
        setUserName(session.name || "");
        setUserEmail(session.email || "");
      }
    };

    loadSession();
  }, []);

  const handleSignOut = async () => {
    await clearAuthSession();
    setIsAuthenticated(false);
    setUserName("");
    setUserEmail("");
    setEmail("");
    setPassword("");
    setEmailTouched(false);
    setPasswordTouched(false);
  };

  if (isAuthenticated) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.background, paddingTop: 80 },
        ]}
      >
        <ThemeToggle />
        <Text style={[styles.title, { color: theme.text }]}>
          {userName ? `Welcome ${userName}` : "Welcome"}
        </Text>
        <Text style={[styles.message, { color: theme.secondaryText }]}>
          {userEmail ? `Your email is ${userEmail}` : "You are signed in."}
        </Text>
        <Text style={[styles.message, { color: theme.secondaryText }]}>
          You are signed in.
        </Text>
        <View style={styles.button}>
          <Button title="Sign Out" onPress={handleSignOut} />
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background, paddingTop: 80 },
      ]}
    >
      <ThemeToggle />
      <Text style={[styles.title, { color: theme.text }]}>Sign in</Text>

      {!SUPABASE_CONFIGURED ? (
        <View style={styles.banner}>
          <Text style={[styles.bannerText, { color: theme.bannerText }]}>
            Supabase is not configured. Add `SUPABASE_URL` and
            `SUPABASE_ANON_KEY` to app.json and restart the app.
          </Text>
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
              backgroundColor: theme.name === "dark" ? "#1f2937" : "#ffffff",
              borderColor: theme.name === "dark" ? "#4b5563" : "#d1d5db",
              color: theme.name === "dark" ? "#f9fafb" : "#111827",
            },
          ]}
          placeholderTextColor={theme.name === "dark" ? "#cbd5e1" : "#6b7280"}
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
          accessibilityLabel={showPassword ? "Hide password" : "Show password"}
          style={({ pressed }) => [{ padding: 6, opacity: pressed ? 0.6 : 1 }]}
        >
          <MaterialCommunityIcons
            name={showPassword ? "eye-off" : "eye"}
            size={22}
            color={theme.text}
          />
        </Pressable>
      </View>

      {passwordError ? (
        <Text style={styles.fieldError}>
          {password
            ? "Password must be at least 6 characters"
            : "Password is required"}
        </Text>
      ) : null}

      {error ? (
        <Text style={[styles.error, { color: theme.error }]}>{error}</Text>
      ) : null}

      <View style={styles.button}>
        <Button
          title={loading ? "Signing in..." : "Sign In"}
          onPress={handleLogin}
          disabled={loading || !formValid || !SUPABASE_CONFIGURED}
        />
      </View>
      <View style={styles.signUpContainer}>
        <Text style={[styles.signUpText, { color: theme.text }]}>
          Don't have an account yet?{" "}
        </Text>
        <Pressable onPress={() => router.push("/sign-up")}>
          <Text style={styles.signUpLink}>Sign Up</Text>
        </Pressable>
      </View>
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
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
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
  button: {
    marginTop: 8,
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
  secondaryButton: {
    marginTop: 8,
  },
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
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
