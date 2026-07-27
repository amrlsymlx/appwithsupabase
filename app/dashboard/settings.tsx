import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getAuthSession } from "../../lib/storage";
import { useTheme } from "../../lib/theme";

export default function SettingsTab() {
  const router = useRouter();
  const { theme } = useTheme();
  const [ready, setReady] = useState(false);

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
      <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
      <Text style={[styles.message, { color: theme.secondaryText }]}>
        Settings tab is ready.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
  },
});
