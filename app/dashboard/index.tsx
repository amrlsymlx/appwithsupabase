import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getAuthSession } from "../../lib/storage";
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
});
