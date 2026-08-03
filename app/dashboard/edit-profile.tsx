import Avatar from "boring-avatars";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SvgXml } from "react-native-svg";
import { getAuthSession, updateAuthSession } from "../../lib/storage";
import { SUPABASE_CONFIGURED, supabase } from "../../lib/supabase";
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

const AVATAR_LIBRARY_OPTIONS = [
  { key: "beam:0:warm", label: "Warm" },
  { key: "marble:1:forest", label: "Forest" },
  { key: "ring:2:slate", label: "Slate" },
  { key: "sunset:3:mint", label: "Mint" },
  { key: "pixel:0:poppy", label: "Poppy" },
  { key: "bauhaus:1:earth", label: "Earth" },
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

export default function EditProfileScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [ready, setReady] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarLibraryKey, setAvatarLibraryKey] = useState<string | null>(null);
  const [updatingAvatar, setUpdatingAvatar] = useState(false);

  const handleBackToSettings = () => {
    router.replace("/dashboard/settings");
  };

  const defaultAvatarSeed = useMemo(() => {
    return `${username}|${email}|${fullName}`;
  }, [email, fullName, username]);

  const buildAvatarSvg = (
    seed: string,
    variant: AvatarVariant,
    colors: readonly string[],
  ) => {
    return renderToStaticMarkup(
      <Avatar
        size={120}
        square={false}
        name={seed || "Anonymous"}
        variant={variant}
        colors={[...colors]}
      />,
    );
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

  const defaultAvatarVariant = useMemo(() => {
    const variantIndex = hashString(defaultAvatarSeed) % AVATAR_VARIANTS.length;
    return AVATAR_VARIANTS[variantIndex];
  }, [defaultAvatarSeed]);

  const defaultAvatarColors = useMemo(() => {
    const colorIndex =
      hashString(`${defaultAvatarSeed}-colors`) % AVATAR_COLOR_PALETTES.length;
    return AVATAR_COLOR_PALETTES[colorIndex];
  }, [defaultAvatarSeed]);

  const defaultAvatarSvg = useMemo(() => {
    return buildAvatarSvg(
      defaultAvatarSeed,
      defaultAvatarVariant,
      defaultAvatarColors,
    );
  }, [defaultAvatarColors, defaultAvatarSeed, defaultAvatarVariant]);

  const selectedLibraryAvatarSvg = useMemo(() => {
    if (!avatarLibraryKey) {
      return null;
    }

    const parsed = parseLibraryKey(avatarLibraryKey);
    return buildAvatarSvg(
      `${defaultAvatarSeed}|${parsed.suffix}`,
      parsed.variant,
      AVATAR_COLOR_PALETTES[parsed.paletteIndex],
    );
  }, [avatarLibraryKey, defaultAvatarSeed]);

  const activeSvgAvatar = selectedLibraryAvatarSvg || defaultAvatarSvg;

  const libraryPreviewItems = useMemo(() => {
    return AVATAR_LIBRARY_OPTIONS.map((option) => {
      const parsed = parseLibraryKey(option.key);
      const xml = buildAvatarSvg(
        `${defaultAvatarSeed}|${parsed.suffix}`,
        parsed.variant,
        AVATAR_COLOR_PALETTES[parsed.paletteIndex],
      );

      return {
        ...option,
        xml,
      };
    });
  }, [defaultAvatarSeed]);

  const saveAvatarUri = async (nextUri: string) => {
    setUpdatingAvatar(true);
    try {
      setAvatarUri(nextUri);
      setAvatarLibraryKey(null);
      await updateAuthSession({
        avatarUri: nextUri,
        avatarLibraryKey: null,
      });

      if (SUPABASE_CONFIGURED && supabase) {
        await supabase.auth.updateUser({
          data: {
            avatarUri: nextUri,
            avatarLibraryKey: null,
          },
        } as any);
      }
    } catch (error: any) {
      Alert.alert("Avatar update failed", error?.message || "Try again.");
    } finally {
      setUpdatingAvatar(false);
    }
  };

  const handleSelectLibraryAvatar = async (nextLibraryKey: string) => {
    setUpdatingAvatar(true);
    try {
      setAvatarUri(null);
      setAvatarLibraryKey(nextLibraryKey);
      await updateAuthSession({
        avatarUri: null,
        avatarLibraryKey: nextLibraryKey,
      });

      if (SUPABASE_CONFIGURED && supabase) {
        await supabase.auth.updateUser({
          data: {
            avatarUri: null,
            avatarLibraryKey: nextLibraryKey,
          },
        } as any);
      }
    } catch (error: any) {
      Alert.alert("Avatar update failed", error?.message || "Try again.");
    } finally {
      setUpdatingAvatar(false);
    }
  };

  const handleChooseFromDevice = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission required",
        "Please allow photo library access to choose an avatar.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      await saveAvatarUri(result.assets[0].uri);
    }
  };

  const handleTakePicture = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission required",
        "Please allow camera access to take an avatar photo.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      cameraType: ImagePicker.CameraType.front,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      await saveAvatarUri(result.assets[0].uri);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      const session = await getAuthSession();
      if (!session?.authenticated) {
        router.replace("/");
        return;
      }

      setFullName(session.name || "-");
      setEmail(session.email || "-");
      setPhoneNumber(session.phoneNumber || "N/A");
      setAddress(session.address || "N/A");
      setUsername(session.username || "N/A");
      setRole(session.role || "user");
      setAvatarUri(session.avatarUri || null);
      setAvatarLibraryKey(session.avatarLibraryKey || null);

      setReady(true);
    };

    checkSession();
  }, [router]);

  if (!ready) {
    return null;
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.containerContent}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        style={({ pressed }) => [
          styles.backButton,
          pressed && styles.backButtonPressed,
        ]}
        onPress={handleBackToSettings}
        hitSlop={10}
      >
        <Text style={styles.backButtonText}>Back to Settings</Text>
      </Pressable>

      <Text style={[styles.title, { color: theme.text }]}>Edit Profile</Text>
      <Text style={[styles.message, { color: theme.secondaryText }]}>
        Edit profile page is ready.
      </Text>

      <View style={[styles.avatarCard, { borderColor: theme.border }]}>
        <View style={styles.avatarFrame}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <SvgXml xml={activeSvgAvatar} width="100%" height="100%" />
          )}
        </View>

        <View style={styles.avatarActionsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.avatarActionButton,
              pressed && styles.avatarActionButtonPressed,
            ]}
            onPress={handleChooseFromDevice}
            hitSlop={10}
            disabled={updatingAvatar}
          >
            <Text style={styles.avatarActionButtonText}>Upload Avatar</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.avatarActionButton,
              pressed && styles.avatarActionButtonPressed,
            ]}
            onPress={handleTakePicture}
            hitSlop={10}
            disabled={updatingAvatar}
          >
            <Text style={styles.avatarActionButtonText}>Take Picture</Text>
          </Pressable>
        </View>

        <View style={styles.avatarLibrarySection}>
          <Text style={[styles.avatarLibraryTitle, { color: theme.text }]}>
            Choose from avatar library
          </Text>
          <View style={styles.avatarLibraryGrid}>
            {libraryPreviewItems.map((item) => {
              const selected = avatarLibraryKey === item.key;

              return (
                <Pressable
                  key={item.key}
                  style={[
                    styles.avatarLibraryItem,
                    selected && styles.avatarLibraryItemSelected,
                  ]}
                  onPress={() => handleSelectLibraryAvatar(item.key)}
                  disabled={updatingAvatar}
                >
                  <View style={styles.avatarLibraryPreviewFrame}>
                    <SvgXml xml={item.xml} width="100%" height="100%" />
                  </View>
                  <Text style={styles.avatarLibraryItemText}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <View style={[styles.infoCard, { borderColor: theme.border }]}>
        <Text style={[styles.fieldLabel, { color: theme.secondaryText }]}>
          Full Name
        </Text>
        <Text style={[styles.fieldValue, { color: theme.text }]}>
          {fullName}
        </Text>

        <Text
          style={[
            styles.fieldLabel,
            styles.fieldLabelSpacing,
            { color: theme.secondaryText },
          ]}
        >
          Email
        </Text>
        <Text style={[styles.fieldValue, { color: theme.text }]}>{email}</Text>

        <Text
          style={[
            styles.fieldLabel,
            styles.fieldLabelSpacing,
            { color: theme.secondaryText },
          ]}
        >
          Phone Number
        </Text>
        <Text style={[styles.fieldValue, { color: theme.text }]}>
          {phoneNumber}
        </Text>

        <Text
          style={[
            styles.fieldLabel,
            styles.fieldLabelSpacing,
            { color: theme.secondaryText },
          ]}
        >
          Address
        </Text>
        <Text style={[styles.fieldValue, { color: theme.text }]}>
          {address}
        </Text>

        <Text
          style={[
            styles.fieldLabel,
            styles.fieldLabelSpacing,
            { color: theme.secondaryText },
          ]}
        >
          Username
        </Text>
        <Text style={[styles.fieldValue, { color: theme.text }]}>
          {username}
        </Text>

        <Text
          style={[
            styles.fieldLabel,
            styles.fieldLabelSpacing,
            { color: theme.secondaryText },
          ]}
        >
          Role
        </Text>
        <Text style={[styles.fieldValue, { color: theme.text }]}>{role}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerContent: {
    justifyContent: "flex-start",
    alignItems: "flex-start",
    padding: 24,
    paddingTop: 60,
    position: "relative",
    paddingBottom: 36,
  },
  backButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#e5edff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    marginBottom: 18,
  },
  backButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  backButtonText: {
    color: "#1e3a8a",
    fontSize: 14,
    fontWeight: "700",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    marginBottom: 16,
  },
  avatarCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#ffffff",
    marginBottom: 16,
    alignItems: "center",
  },
  avatarFrame: {
    width: 120,
    height: 120,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 14,
    backgroundColor: "#f3f4f6",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  avatarActionsRow: {
    width: "100%",
    gap: 10,
    marginBottom: 14,
  },
  avatarActionButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#dbeafe",
    borderWidth: 1,
    borderColor: "#93c5fd",
  },
  avatarActionButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  avatarActionButtonText: {
    color: "#1e3a8a",
    fontSize: 14,
    fontWeight: "700",
  },
  avatarLibrarySection: {
    width: "100%",
  },
  avatarLibraryTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  avatarLibraryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  avatarLibraryItem: {
    width: "31%",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
    backgroundColor: "#f8fbff",
  },
  avatarLibraryItemSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  avatarLibraryPreviewFrame: {
    width: 56,
    height: 56,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#e5e7eb",
    marginBottom: 6,
  },
  avatarLibraryItemText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e3a8a",
  },
  infoCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#ffffff",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  fieldLabelSpacing: {
    marginTop: 12,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: "700",
  },
});
