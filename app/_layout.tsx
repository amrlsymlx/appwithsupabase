import { Stack } from "expo-router";
import { ThemeProvider } from "../lib/theme";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          presentation: "transparentModal",
        }}
      />
    </ThemeProvider>
  );
}
