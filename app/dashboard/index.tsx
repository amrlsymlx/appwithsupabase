import { bottts } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { getAuthSession, updateAuthSession } from "../../lib/storage";
import { SUPABASE_CONFIGURED, supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/theme";

const parseLibraryKey = (key: string) => {
  const [, suffixRaw] = key.split(":");
  return suffixRaw || "default";
};

export default function DashboardHomeTab() {
  const router = useRouter();
  const { theme } = useTheme();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarLibraryKey, setAvatarLibraryKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const activeAvatarSeed = useMemo(() => {
    if (avatarLibraryKey) {
      return `${userEmail || "anonymous"}|${parseLibraryKey(avatarLibraryKey)}`;
    }
    return userEmail || "anonymous";
  }, [avatarLibraryKey, userEmail]);

  const avatarSvg = useMemo(
    () =>
      createAvatar(bottts, {
        seed: activeAvatarSeed,
        size: 88,
      }).toString(),
    [activeAvatarSeed],
  );

  // Reload session every time this tab comes into focus
  useFocusEffect(
    useCallback(() => {
      const loadSession = async () => {
        const session = await getAuthSession();
        if (!session?.authenticated) {
          router.replace("/");
          return;
        }

        setUserName(session.name || "");
        setUserEmail(session.email || "");
        setAvatarLibraryKey(session.avatarLibraryKey || null);

        // Fetch fresh metadata from Supabase to sync avatar across devices
        let freshAvatarUri = session.avatarUri || null;
        if (SUPABASE_CONFIGURED && supabase) {
          const { data: userData } = await supabase.auth.getUser();
          const meta = userData?.user?.user_metadata || {};
          const avatarPath = meta.avatarPath || session.avatarPath || null;
          const avatarLibKey = meta.avatarLibraryKey || null;
          if (avatarLibKey) {
            freshAvatarUri = null;
            setAvatarLibraryKey(avatarLibKey);
            await updateAuthSession({
              avatarUri: null,
              avatarPath: null,
              avatarLibraryKey: avatarLibKey,
            });
          } else if (avatarPath) {
            const { data: signedUrlData } = await supabase.storage
              .from("avatars")
              .createSignedUrl(avatarPath, 3600);
            freshAvatarUri = signedUrlData?.signedUrl || null;
            setAvatarLibraryKey(null);
            await updateAuthSession({
              avatarUri: freshAvatarUri,
              avatarPath,
              avatarLibraryKey: null,
            });
          } else {
            freshAvatarUri = null;
            setAvatarLibraryKey(null);
            await updateAuthSession({
              avatarUri: null,
              avatarPath: null,
              avatarLibraryKey: null,
            });
          }
        }
        setAvatarUri(freshAvatarUri);
        setReady(true);
      };

      loadSession();
    }, [router]),
  );

  if (!ready) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <View style={styles.headerRow}>
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
        <View style={styles.avatarWrap}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <SvgXml xml={avatarSvg} width="100%" height="100%" />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    position: "relative",
  },
  textContainer: {
    flex: 1,
    alignItems: "flex-start",
    backgroundColor: "transparent",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    width: "100%",
  },
  avatarWrap: {
    width: 50,
    height: 50,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#f3f4f6",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    // alignItems: "flex-end",
    // justifyContent: "flex-end",
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
