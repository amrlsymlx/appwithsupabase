import Avatar from "boring-avatars";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Image, StyleSheet, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { getAuthSession } from "../../lib/storage";
import { useTheme } from "../../lib/theme";

const AVATAR_VARIANTS = [
  "marble",
  "beam",
  "pixel",
  "sunset",
  "ring",
  "bauhaus",
] as const;

const AVATAR_COLOR_PALETTES = [
  ["#A3A3A3", "#F59E0B", "#F43F5E", "#0EA5E9", "#22C55E"],
  ["#5B8C5A", "#F2C14E", "#F78154", "#4D9078", "#B4436C"],
  ["#0F172A", "#334155", "#64748B", "#94A3B8", "#E2E8F0"],
  ["#0F766E", "#14B8A6", "#5EEAD4", "#99F6E4", "#CCFBF1"],
] as const;

type AvatarVariant = (typeof AVATAR_VARIANTS)[number];

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const parseLibraryKey = (key: string) => {
  const [variantRaw, paletteRaw, suffixRaw] = key.split(":");
  const variant = AVATAR_VARIANTS.includes(variantRaw as AvatarVariant)
    ? (variantRaw as AvatarVariant)
    : "marble";
  const paletteIndex = Number.parseInt(paletteRaw ?? "0", 10);
  const normalizedPaletteIndex = Number.isFinite(paletteIndex)
    ? Math.max(0, Math.min(AVATAR_COLOR_PALETTES.length - 1, paletteIndex))
    : 0;
  const suffix = suffixRaw || "default";

  return { variant, paletteIndex: normalizedPaletteIndex, suffix };
};

const buildAvatarSvg = (
  seed: string,
  variant: AvatarVariant,
  colors: readonly string[],
) => {
  return renderToStaticMarkup(
    <Avatar
      size={88}
      square={false}
      name={seed || "Anonymous"}
      variant={variant}
      colors={[...colors]}
    />,
  );
};

export default function DashboardHomeTab() {
  const router = useRouter();
  const { theme } = useTheme();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarLibraryKey, setAvatarLibraryKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const avatarSeed = useMemo(() => {
    return `${userName}|${userEmail}`;
  }, [userEmail, userName]);

  const defaultAvatarVariant = useMemo(() => {
    const variantIndex = hashString(avatarSeed) % AVATAR_VARIANTS.length;
    return AVATAR_VARIANTS[variantIndex];
  }, [avatarSeed]);

  const defaultAvatarColors = useMemo(() => {
    const colorIndex =
      hashString(`${avatarSeed}-colors`) % AVATAR_COLOR_PALETTES.length;
    return AVATAR_COLOR_PALETTES[colorIndex];
  }, [avatarSeed]);

  const defaultAvatarSvg = useMemo(() => {
    return buildAvatarSvg(
      avatarSeed,
      defaultAvatarVariant,
      defaultAvatarColors,
    );
  }, [avatarSeed, defaultAvatarVariant, defaultAvatarColors]);

  const selectedLibraryAvatarSvg = useMemo(() => {
    if (!avatarLibraryKey) {
      return null;
    }

    const parsed = parseLibraryKey(avatarLibraryKey);
    return buildAvatarSvg(
      `${avatarSeed}|${parsed.suffix}`,
      parsed.variant,
      AVATAR_COLOR_PALETTES[parsed.paletteIndex],
    );
  }, [avatarLibraryKey, avatarSeed]);

  const activeSvgAvatar = selectedLibraryAvatarSvg || defaultAvatarSvg;

  useEffect(() => {
    const loadSession = async () => {
      const session = await getAuthSession();
      if (!session?.authenticated) {
        router.replace("/");
        return;
      }

      setUserName(session.name || "");
      setUserEmail(session.email || "");
      setAvatarUri(session.avatarUri || null);
      setAvatarLibraryKey(session.avatarLibraryKey || null);
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
        <View style={styles.avatarWrap}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <SvgXml xml={activeSvgAvatar} width="100%" height="100%" />
          )}
        </View>

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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    position: "relative",
  },
  textContainer: {
    flex: 1,
    alignItems: "flex-start",
    width: "100%",
    backgroundColor: "transparent",
  },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#f3f4f6",
    marginBottom: 16,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
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
