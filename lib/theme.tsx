import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";

export type ThemeName = "light" | "dark";

export type AppTheme = {
  name: ThemeName;
  background: string;
  surface: string;
  text: string;
  secondaryText: string;
  border: string;
  inputBackground: string;
  inputText: string;
  bannerBackground: string;
  bannerText: string;
  statusBackground: string;
  statusText: string;
  error: string;
  accent: string;
};

const themes: Record<ThemeName, AppTheme> = {
  light: {
    name: "light",
    background: "#f5f7fb",
    surface: "#ffffff",
    text: "#111827",
    secondaryText: "#4b5563",
    border: "#d1d5db",
    inputBackground: "#ffffff",
    inputText: "#111827",
    bannerBackground: "#fff7d6",
    bannerText: "#7c4a00",
    statusBackground: "#e8f4ff",
    statusText: "#0b3d91",
    error: "#c00",
    accent: "#2563eb",
  },
  dark: {
    name: "dark",
    background: "#111827",
    surface: "#1f2937",
    text: "#f9fafb",
    secondaryText: "#d1d5db",
    border: "#4b5563",
    inputBackground: "#374151",
    inputText: "#f9fafb",
    bannerBackground: "#4a3b00",
    bannerText: "#fef3c7",
    statusBackground: "#1e3a5f",
    statusText: "#dbeafe",
    error: "#f87171",
    accent: "#60a5fa",
  },
};

type ThemeContextValue = {
  theme: AppTheme;
  themeName: ThemeName;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>("light");

  const theme = useMemo(() => themes[themeName], [themeName]);

  const toggleTheme = () => {
    setThemeName((current) => (current === "light" ? "dark" : "light"));
  };

  const value = useMemo(
    () => ({ theme, themeName, toggleTheme }),
    [theme, themeName],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}

export function ThemeToggle() {
  const { themeName, toggleTheme } = useTheme();
  const knobOffset = useRef(
    new Animated.Value(themeName === "dark" ? 12 : 0),
  ).current;

  useEffect(() => {
    Animated.timing(knobOffset, {
      toValue: themeName === "dark" ? 12 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [knobOffset, themeName]);

  const trackColor = themeName === "dark" ? "#60a5fa" : "#d1d5db";
  const thumbColor = themeName === "dark" ? "#f9fafb" : "#ffffff";

  return (
    <Pressable
      onPress={toggleTheme}
      style={styles.switchContainer}
      accessibilityRole="switch"
      accessibilityState={{ checked: themeName === "dark" }}
    >
      <View style={styles.labelRow}>
        <MaterialCommunityIcons
          name="weather-sunny"
          size={14}
          color={themeName === "light" ? "#2563eb" : "#6b7280"}
        />
        <Animated.View
          style={[
            styles.track,
            {
              backgroundColor: trackColor,
              borderColor: themeName === "dark" ? "#60a5fa" : "#9ca3af",
            },
          ]}
        >
          <Animated.View
            style={[
              styles.thumb,
              {
                backgroundColor: thumbColor,
                transform: [{ translateX: knobOffset }],
              },
            ]}
          />
        </Animated.View>
        <MaterialCommunityIcons
          name="weather-night"
          size={14}
          color={themeName === "dark" ? "#2563eb" : "#6b7280"}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  switchContainer: {
    position: "absolute",
    top: 56,
    right: 16,
    zIndex: 10,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  labelText: {
    fontSize: 12,
    fontWeight: "600",
  },
  activeLabel: {
    color: "#2563eb",
  },
  inactiveLabel: {
    color: "#6b7280",
  },
  track: {
    width: 28,
    height: 16,
    borderRadius: 999,
    borderWidth: 1,
    padding: 1,
    justifyContent: "center",
  },
  thumb: {
    width: 12,
    height: 12,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
});
