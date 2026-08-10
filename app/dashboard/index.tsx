import { bottts } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { useDashboardDrawer } from "../../components/dashboard/DrawerContext";
import { getAuthSession, updateAuthSession } from "../../lib/storage";
import { SUPABASE_CONFIGURED, supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/theme";

const parseLibraryKey = (key: string) => {
  const [, suffixRaw] = key.split(":");
  return suffixRaw || "default";
};

export default function DashboardHomeTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { progress: drawerProgress, openDrawer } = useDashboardDrawer();
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

  const avatarOpacity = useMemo(
    () =>
      drawerProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
      }),
    [drawerProgress],
  );

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const loadSession = async () => {
        const session = await getAuthSession();
        if (!session?.authenticated) {
          router.replace("/");
          return;
        }

        if (!mounted) {
          return;
        }

        setUserName(session.name || "");
        setUserEmail(session.email || "");
        setAvatarLibraryKey(session.avatarLibraryKey || null);

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

        if (mounted) {
          setAvatarUri(freshAvatarUri);
          setReady(true);
        }
      };

      void loadSession();

      return () => {
        mounted = false;
      };
    }, [router]),
  );

  if (!ready) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* On web skip opacity animation â€” invisible Animated.View blocks pointer events */}
      {Platform.OS === "web" ? (
        <Pressable
          onPress={openDrawer}
          style={[
            styles.avatarTrigger,
            {
              backgroundColor: theme.surface,
              top: 16 + insets.top,
            },
          ]}
          hitSlop={8}
        >
          <View
            style={[
              styles.avatarWrap,
              { backgroundColor: theme.inputBackground },
            ]}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <SvgXml xml={avatarSvg} width="100%" height="100%" />
            )}
          </View>
        </Pressable>
      ) : (
        <Animated.View style={{ opacity: avatarOpacity }}>
          <Pressable
            onPress={openDrawer}
            style={[
              styles.avatarTrigger,
              {
                borderColor: theme.border,
                backgroundColor: theme.surface,
                top: 16 + insets.top,
              },
            ]}
            hitSlop={8}
          >
            <View
              style={[
                styles.avatarWrap,
                { backgroundColor: theme.inputBackground },
              ]}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <SvgXml xml={avatarSvg} width="100%" height="100%" />
              )}
            </View>
          </Pressable>
        </Animated.View>
      )}

      <View style={styles.contentArea}>
        <Text style={[styles.title, { color: theme.text }]}>
          {userName ? `Welcome ${userName}` : "Welcome"}
        </Text>
        <Text style={[styles.message, { color: theme.secondaryText }]}>
          {userEmail ? `Your email is ${userEmail}` : "You are signed in."}
        </Text>
        <Text style={[styles.message, { color: theme.secondaryText }]}>
          Tap the avatar or swipe right anywhere to open the drawer.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
    paddingHorizontal: 18,
  },
  avatarTrigger: {
    position: "absolute",
    left: 10,
    zIndex: 20,
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 999,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  contentArea: {
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: 130,
    paddingRight: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "left",
  },
  message: {
    fontSize: 16,
    textAlign: "left",
    marginBottom: 16,
  },
});
