import { Stack, usePathname } from "expo-router";
import { StyleSheet, View } from "react-native";
import { ThemeProvider, ThemeToggle } from "../lib/theme";

export default function RootLayout() {
  const pathname = usePathname();
  const showThemeToggle =
    pathname === "/" ||
    pathname === "/sign-up" ||
    pathname === "/dashboard/settings";

  return (
    <ThemeProvider>
      <View style={styles.root}>
        <Stack
          screenOptions={{
            headerShown: false,
            presentation: "card",
          }}
        />
        {showThemeToggle ? <ThemeToggle /> : null}
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
