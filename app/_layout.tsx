import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { ThemeProvider, useTheme } from "../lib/theme";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { themeName } = useTheme();

  return (
    <View style={styles.root}>
      <StatusBar style={themeName === "light" ? "dark" : "light"} />
      <Stack
        screenOptions={{
          headerShown: false,
          presentation: "card",
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
