import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();

  const [churchId, setChurchId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!churchId.trim() || !password.trim()) {
      Alert.alert("Required", "Please enter your Church ID and password.");
      return;
    }
    setLoading(true);
    try {
      const { passwordChangeRequired } = await login(churchId.trim().toUpperCase(), password);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (passwordChangeRequired) {
        router.replace("/change-password");
      } else {
        router.replace("/(tabs)/hub");
      }
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Login Failed", "Invalid Church ID or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const s = styles(colors, insets);

  return (
    <View style={s.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.header}>
            <View style={s.logoCircle}>
              <Text style={s.logoStar}>✦</Text>
            </View>
            <Text style={s.appName}>STELLIFY</Text>
            <Text style={s.tagline}>Jesus the Most Precious Name Church</Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Sign In</Text>
            <Text style={s.cardSubtitle}>Enter your PCM or TCM credentials</Text>

            <View style={s.field}>
              <Text style={s.label}>CHURCH ID</Text>
              <TextInput
                style={s.input}
                placeholder="PCM0001 or TCM0001"
                placeholderTextColor={colors.mutedForeground}
                value={churchId}
                onChangeText={setChurchId}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>PASSWORD</Text>
              <TextInput
                style={s.input}
                placeholder="Enter your password"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            <Pressable
              style={({ pressed }) => [s.loginBtn, pressed && { opacity: 0.85 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={s.loginBtnText}>Sign In</Text>
              )}
            </Pressable>
          </View>

          <Text style={s.footer}>Press Church · Stellify v1.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = (colors: ReturnType<typeof import("@/hooks/useColors").useColors>, insets: ReturnType<typeof import("react-native-safe-area-context").useSafeAreaInsets>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flexGrow: 1,
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
      paddingBottom: insets.bottom + 32,
      paddingHorizontal: 24,
      justifyContent: "center",
    },
    header: {
      alignItems: "center",
      marginBottom: 40,
    },
    logoCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
      shadowColor: colors.primary,
      shadowOpacity: 0.4,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    logoStar: {
      fontSize: 36,
      color: "#FFFFFF",
    },
    appName: {
      fontSize: 28,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      letterSpacing: 6,
    },
    tagline: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 4,
      textAlign: "center",
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius * 2,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTitle: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 4,
    },
    cardSubtitle: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginBottom: 24,
    },
    field: {
      marginBottom: 16,
    },
    label: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      letterSpacing: 1,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.secondary,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    loginBtn: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 8,
    },
    loginBtnText: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.primaryForeground,
    },
    footer: {
      textAlign: "center",
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 32,
    },
  });
