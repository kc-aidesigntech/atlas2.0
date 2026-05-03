/**
 * Expo Router root layout that defines the mobile auth boundary and the only
 * route groups rendered inside the shared AuthProvider session context.
 */
import { Stack } from "expo-router";
import { AuthProvider } from "../src/auth/AuthProvider";

export default function RootLayout() {
  return (
    <AuthProvider>
      {/* AuthProvider owns session bootstrap; route groups below only decide which authenticated boundary to render. */}
      <Stack screenOptions={{ headerStyle: { backgroundColor: "#0b0b0b" }, headerTintColor: "#ffffff", contentStyle: { backgroundColor: "#000000" } }}>
        {/* Keep index as the single auth gate so individual screens do not duplicate redirect logic. */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/sign-in" options={{ title: "sign in" }} />
        <Stack.Screen name="(app)/navigation" options={{ title: "navigator view" }} />
      </Stack>
    </AuthProvider>
  );
}
