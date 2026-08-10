import { bottts } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { DashboardDrawerContext } from "../../components/dashboard/DrawerContext";
import {
  clearAuthSession,
  getAuthSession,
  updateAuthSession,
} from "../../lib/storage";
import { supabase, SUPABASE_CONFIGURED } from "../../lib/supabase";
import { ThemeToggle, useTheme } from "../../lib/theme";

const PREVIEW_PORTION = 0.1;
const DRAWER_RADIUS = 30;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const parseLibraryKey = (key: string) => {
  const [, suffixRaw] = key.split(":");
  return suffixRaw || "default";
};

export default function DashboardTabsLayout() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarLibraryKey, setAvatarLibraryKey] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const progress = useRef(new Animated.Value(0)).current;
  const currentProgress = useRef(0);
  const gestureStartProgress = useRef(0);

  const previewWidth = Math.max(1, width * PREVIEW_PORTION);
  const openTranslateX = Math.max(1, width - previewWidth);
  const drawerContentTop = Math.max(56, insets.top + 48);
  const drawerContentLift = Math.round(height * 0.25);

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

  const pageTranslateX = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, openTranslateX],
      }),
    [openTranslateX, progress],
  );

  const pageCornerRadius = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, DRAWER_RADIUS],
      }),
    [progress],
  );

  const animateTo = (target: 0 | 1) => {
    Animated.spring(progress, {
      toValue: target,
      useNativeDriver: Platform.OS !== "web",
      friction: 9,
      tension: 85,
    }).start();
    currentProgress.current = target;
    setIsDrawerOpen(target > 0.01);
  };

  const openDrawer = () => {
    animateTo(1);
  };

  const closeDrawer = () => {
    animateTo(0);
  };

  const toggleDrawer = () => {
    animateTo(currentProgress.current > 0.5 ? 0 : 1);
  };

  const panResponder = useMemo(() => {
    if (Platform.OS === "web") {
      return null;
    }

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const horizontal = Math.abs(gestureState.dx);
        const vertical = Math.abs(gestureState.dy);
        return horizontal > 6 && horizontal > vertical * 1.1;
      },
      onPanResponderGrant: () => {
        gestureStartProgress.current = currentProgress.current;
      },
      onPanResponderMove: (_, gestureState) => {
        const nextProgress = clamp(
          gestureStartProgress.current + gestureState.dx / openTranslateX,
          0,
          1,
        );
        currentProgress.current = nextProgress;
        progress.setValue(nextProgress);
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderRelease: (_, gestureState) => {
        const thresholdOpen = currentProgress.current > 0.5;
        const flingRight = gestureState.vx > 0.2;
        const flingLeft = gestureState.vx < -0.2;
        const target = flingRight ? 1 : flingLeft ? 0 : thresholdOpen ? 1 : 0;
        animateTo(target);
      },
    });
  }, [openTranslateX, progress]);

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
        }
      };

      void loadSession();

      return () => {
        mounted = false;
      };
    }, [router]),
  );

  const drawerContextValue = useMemo(
    () => ({
      progress,
      openDrawer,
      closeDrawer,
      toggleDrawer,
    }),
    [progress],
  );

  return (
    <DashboardDrawerContext.Provider value={drawerContextValue}>
      <View style={[styles.root, { backgroundColor: theme.surface }]}>
        <View
          pointerEvents={isDrawerOpen ? "auto" : "none"}
          style={[styles.drawerLayer, { backgroundColor: theme.surface }]}
        >
          {/* Transparent swipe strip; box-only on native so buttons stay tappable */}
          {panResponder ? (
            <Animated.View
              {...panResponder.panHandlers}
              style={styles.swipeZone}
            />
          ) : null}
          <Animated.View
            {...(panResponder?.panHandlers ?? {})}
            style={[
              styles.drawerSurface,
              { width: openTranslateX, paddingTop: insets.top + 10 },
            ]}
          >
            <View style={styles.drawerHeader}>
              <ThemeToggle inline />
              <Pressable
                onPress={closeDrawer}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.closeButton,
                  { backgroundColor: theme.inputBackground },
                  pressed && styles.drawerItemPressed,
                ]}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={18}
                  color={theme.secondaryText}
                />
              </Pressable>
            </View>

            <View style={{ transform: [{ translateY: -drawerContentLift }] }}>
              <View
                style={[styles.drawerProfile, { marginTop: drawerContentTop }]}
              >
                <View
                  style={[
                    styles.drawerAvatarWrap,
                    { backgroundColor: theme.inputBackground },
                  ]}
                >
                  {avatarUri ? (
                    <Image
                      source={{ uri: avatarUri }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <SvgXml xml={avatarSvg} width="100%" height="100%" />
                  )}
                </View>
                <Text
                  style={[styles.drawerName, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {userName || "Welcome"}
                </Text>
                <Text
                  style={[styles.drawerEmail, { color: theme.secondaryText }]}
                  numberOfLines={1}
                >
                  {userEmail || ""}
                </Text>
              </View>

              <View style={styles.drawerMenu}>
                <Pressable
                  onPress={() => {
                    closeDrawer();
                    router.replace("/dashboard");
                  }}
                  style={({ pressed }) => [
                    styles.drawerItem,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                    },
                    pressed && styles.drawerItemPressed,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="home-outline"
                    size={20}
                    color={theme.accent}
                  />
                  <Text style={[styles.drawerItemLabel, { color: theme.text }]}>
                    Home
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    closeDrawer();
                    router.replace("/dashboard/settings");
                  }}
                  style={({ pressed }) => [
                    styles.drawerItem,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                    },
                    pressed && styles.drawerItemPressed,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="cog-outline"
                    size={20}
                    color={theme.accent}
                  />
                  <Text style={[styles.drawerItemLabel, { color: theme.text }]}>
                    Settings
                  </Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={async () => {
                closeDrawer();
                await supabase?.auth.signOut();
                await clearAuthSession();
                router.replace("/");
              }}
              style={({ pressed }) => [
                styles.signOutItem,
                { paddingBottom: insets.bottom + 16 },
                pressed && styles.drawerItemPressed,
              ]}
            >
              <MaterialCommunityIcons name="logout" size={20} color="#ef4444" />
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </Animated.View>
        </View>

        <Animated.View
          {...(panResponder?.panHandlers ?? {})}
          pointerEvents={isDrawerOpen ? "none" : "auto"}
          style={[
            styles.pageShell,
            {
              backgroundColor: theme.background,
              transform: [{ translateX: pageTranslateX }],
              borderTopLeftRadius: pageCornerRadius,
              borderBottomLeftRadius: pageCornerRadius,
            },
          ]}
        >
          <Tabs
            initialRouteName="index"
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: theme.accent,
              tabBarInactiveTintColor: theme.secondaryText,
              tabBarStyle: {
                backgroundColor: theme.surface,
                borderTopColor: theme.border,
                height: Platform.OS === "ios" ? 78 : 64,
                paddingTop: 6,
                paddingBottom: Platform.OS === "ios" ? 16 : 6,
              },
              tabBarShowLabel: false,
              tabBarLabelStyle: {
                display: "none",
              },
            }}
          >
            <Tabs.Screen
              name="index"
              options={{
                title: "Home",
                tabBarIcon: ({ focused, color, size }) => (
                  <MaterialCommunityIcons
                    name={focused ? "home" : "home-outline"}
                    color={color}
                    size={size}
                  />
                ),
              }}
            />
            <Tabs.Screen
              name="create"
              options={{
                title: "Create",
                tabBarIcon: ({ focused, color, size }) => (
                  <MaterialCommunityIcons
                    name={focused ? "plus-circle" : "plus-circle-outline"}
                    color={color}
                    size={size}
                  />
                ),
              }}
            />
            <Tabs.Screen
              name="settings"
              options={{
                href: null,
              }}
            />
            <Tabs.Screen
              name="edit-profile"
              options={{
                href: null,
              }}
            />
          </Tabs>
        </Animated.View>

        {/* Outside dismiss: tap or swipe-left closes drawer */}
        {isDrawerOpen ? (
          panResponder ? (
            <Animated.View
              {...panResponder.panHandlers}
              style={[styles.outsideOverlay, { left: openTranslateX }]}
            >
              <Pressable
                style={StyleSheet.absoluteFillObject}
                onPress={closeDrawer}
              />
            </Animated.View>
          ) : (
            <Pressable
              onPress={closeDrawer}
              style={[styles.outsideOverlay, { left: openTranslateX }]}
            />
          )
        ) : null}
      </View>
    </DashboardDrawerContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },
  drawerLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-start",
    zIndex: 1,
  },
  drawerSurface: {
    flex: 1,
    paddingTop: 14,
    paddingHorizontal: 14,
    justifyContent: "space-between",
  },
  swipeZone: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    zIndex: 0,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  drawerProfile: {
    alignItems: "flex-start",
    marginTop: 12,
    marginBottom: 16,
  },
  drawerAvatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 8,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  drawerName: {
    fontSize: 22,
    fontWeight: "800",
  },
  drawerEmail: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "500",
  },
  drawerMenu: {
    gap: 8,
    width: "72%",
    maxWidth: 250,
  },
  signOutItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    width: "72%",
    maxWidth: 250,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ef4444",
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  drawerItemPressed: {
    opacity: 0.88,
  },
  drawerItemLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  pageShell: {
    flex: 1,
    overflow: "hidden",
    zIndex: 2,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  outsideOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
});
