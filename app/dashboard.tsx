import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { clearAuthSession, getAuthSession } from "../lib/storage";
import { ThemeToggle, useTheme } from "../lib/theme";

export default function Dashboard() {
  const router = useRouter();
  const { theme } = useTheme();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      const session = await getAuthSession();
      if (!session?.authenticated) {
        router.replace("/");
        return;
      }

      setUserName(session.name || "");
      setUserEmail(session.email || "");
      setReady(true);
    };

    loadSession();
  }, [router]);

  const handleSignOut = async () => {
    await clearAuthSession();
    router.replace("/");
  };

  if (!ready) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
    marginBottom: 24,
  },
  button: {
    marginTop: 8,
  },
});
