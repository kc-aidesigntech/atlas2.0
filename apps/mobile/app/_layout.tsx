import { Stack } from "expo-router";
import { AuthProvider } from "../src/auth/AuthProvider";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerStyle: { backgroundColor: "#0b0b0b" }, headerTintColor: "#ffffff", contentStyle: { backgroundColor: "#000000" } }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/sign-in" options={{ title: "sign in" }} />
        <Stack.Screen name="(app)/navigation" options={{ title: "navigator view" }} />
      </Stack>
    </AuthProvider>
  );
}
