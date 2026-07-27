import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";
import { ThemeProvider, ThemeToggle } from "../lib/theme";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <View style={styles.root}>
        <Stack
          screenOptions={{
            headerShown: false,
            presentation: "card",
          }}
        />
        <ThemeToggle />
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
