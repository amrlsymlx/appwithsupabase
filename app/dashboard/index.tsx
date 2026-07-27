import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { clearAuthSession, getAuthSession } from "../../lib/storage";
import { useTheme } from "../../lib/theme";

export default function DashboardHomeTab() {
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
    try {
      await clearAuthSession();
    } catch (error) {
      console.warn("Failed to clear auth session", error);
    } finally {
      setUserName("");
      setUserEmail("");
      router.replace("/");
    }
  };

  if (!ready) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: theme.text }]}>
          {userName ? `Welcome ${userName}` : "Welcome"}
        </Text>
        <Text style={[styles.message, { color: theme.secondaryText }]}>
          {userEmail ? `Your email is ${userEmail}` : "You are signed in."}
        </Text>
        <Text style={[styles.message, { color: theme.secondaryText }]}>
          You are signed in.
        </Text>
      </View>

      <View style={styles.signOutRow}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
          onPress={handleSignOut}
          hitSlop={10}
        >
          <Text style={styles.primaryButtonText}>Sign Out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    padding: 24,
    paddingTop: 88,
    position: "relative",
  },
  textContainer: {
    flex: 1,
    alignItems: "flex-start",
    width: "100%",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "left",
  },
  message: {
    fontSize: 16,
    color: "#333",
    textAlign: "left",
    marginBottom: 24,
  },
  signOutRow: {
    marginTop: 24,
    width: "100%",
    alignItems: "flex-start",
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: "#1d4ed8",
    zIndex: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  primaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
});
