import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, SafeAreaView, Text, TextInput, View } from "react-native";
import { hasMobileSupabaseConfig, supabase } from "../../src/lib/supabase";

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!supabase) {
      setError("supabase is not configured. set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
      return;
    }

    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.replace("/(app)/navigation");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000000" }}>
      <View style={{ flex: 1, paddingHorizontal: 20, justifyContent: "center", gap: 12 }}>
        <Text style={{ color: "#ffffff", fontSize: 26, fontWeight: "700" }}>ATLAS sign in</Text>
        <Text style={{ color: "#a7a9ac", fontSize: 13 }}>
          {hasMobileSupabaseConfig
            ? "authenticate with your existing Supabase users."
            : "configure mobile Supabase env vars to enable login."}
        </Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="email"
          placeholderTextColor="#7a7a7a"
          value={email}
          onChangeText={setEmail}
          style={{
            borderWidth: 1,
            borderColor: "#2c2c2c",
            borderRadius: 10,
            color: "#ffffff",
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        />
        <TextInput
          secureTextEntry
          placeholder="password"
          placeholderTextColor="#7a7a7a"
          value={password}
          onChangeText={setPassword}
          style={{
            borderWidth: 1,
            borderColor: "#2c2c2c",
            borderRadius: 10,
            color: "#ffffff",
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        />
        {error ? <Text style={{ color: "#ff7373" }}>{error}</Text> : null}
        <Pressable
          disabled={loading || !hasMobileSupabaseConfig}
          onPress={handleSignIn}
          style={{
            backgroundColor: loading || !hasMobileSupabaseConfig ? "#5f5f5f" : "#fccc0a",
            borderRadius: 10,
            paddingVertical: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#000000", fontWeight: "700" }}>
            {loading ? "signing in..." : "sign in"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
