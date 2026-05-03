import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/auth/AuthProvider";

export default function IndexRoute() {
  const { isLoading, session } = useAuth();

  if (isLoading) {
    // Wait for AuthProvider bootstrap to finish so we do not flash sign-in before a persisted session restores.
    return (
      <View style={{ flex: 1, backgroundColor: "#000000", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#fccc0a" />
      </View>
    );
  }

  if (!session) {
    // This is the only unauthenticated branch; all app routes assume a non-null session.
    return <Redirect href="/(auth)/sign-in" />;
  }

  // Successful auth always funnels into the app route group so deep screens inherit the same boundary.
  return <Redirect href="/(app)/navigation" />;
}
