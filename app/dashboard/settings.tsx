import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { clearAuthSession, getAuthSession } from "../../lib/storage";
import { ThemeToggle, useTheme } from "../../lib/theme";

export default function SettingsTab() {
  const router = useRouter();
  const { theme } = useTheme();
  const [ready, setReady] = useState(false);

  const handleSignOut = async () => {
    try {
      await clearAuthSession();
    } catch (error) {
      console.warn("Failed to clear auth session", error);
    } finally {
      router.replace("/");
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      const session = await getAuthSession();
      if (!session?.authenticated) {
        router.replace("/");
        return;
      }

      setReady(true);
    };

    checkSession();
  }, [router]);

  if (!ready) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ThemeToggle />
      <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
      <Text style={[styles.message, { color: theme.secondaryText }]}>
        Settings tab is ready.
      </Text>
      <Pressable
        style={({ pressed }) => [
          styles.signOutButton,
          pressed && styles.signOutButtonPressed,
        ]}
        onPress={handleSignOut}
        hitSlop={10}
      >
        <Text style={styles.signOutButtonText}>Sign Out</Text>
      </Pressable>
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
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    marginBottom: 24,
  },
  signOutButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: "#1d4ed8",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  signOutButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  signOutButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
});
