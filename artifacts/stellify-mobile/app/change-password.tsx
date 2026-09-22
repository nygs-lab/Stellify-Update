import { Ionicons } from "@expo/vector-icons";
import { useChangePassword, getGetMeQueryKey } from "@workspace/api-client-react";
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
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function ChangePasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { member, logout } = useAuth();
  const queryClient = useQueryClient();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { mutateAsync: changePassword, isPending } = useChangePassword();

  const firstName = (member as Record<string, unknown> | null)?.["firstName"] as string | undefined;
  const name = firstName ?? "there";

  async function handleSubmit() {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Required", "Please fill in all fields.");
      return;
    }
    if (newPassword.length < 6) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Too Short", "New password must be at least 6 characters.");
      return;
    }
    if (newPassword === currentPassword) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Same Password", "Your new password must be different from your current password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Mismatch", "New password and confirmation do not match.");
      return;
    }

    try {
      await changePassword({ data: { currentPassword, newPassword } });

      queryClient.setQueryData(getGetMeQueryKey(), (old: Record<string, unknown> | null | undefined) =>
        old ? { ...old, mustChangePassword: false } : old
      );

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Password Updated",
        "Welcome to Stellify! Your password has been set successfully.",
        [{ text: "Continue", onPress: () => router.replace("/(tabs)/hub") }]
      );
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Could not update password. Please check your current password and try again.");
    }
  }

  async function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  }

  const s = makeStyles(colors, insets);

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
          {/* Icon + header */}
          <View style={s.header}>
            <View style={[s.iconCircle, { backgroundColor: colors.primary + "20" }]}>
              <Ionicons name="shield-checkmark" size={40} color={colors.primary} />
            </View>
            <Text style={[s.title, { color: colors.primary }]}>Set Your Password</Text>
            <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
              Welcome, {name}! For your security, please create a personal password before continuing.
            </Text>
          </View>

          {/* Form card */}
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Current password */}
            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Current Password</Text>
            <View style={[s.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.mutedForeground} style={{ marginRight: 6 }} />
              <TextInput
                style={[s.input, { color: colors.foreground }]}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Your current default password"
                placeholderTextColor={colors.mutedForeground}
                editable={!isPending}
                returnKeyType="next"
              />
            </View>

            {/* New password */}
            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>New Password</Text>
            <View style={[s.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Ionicons name="key-outline" size={16} color={colors.mutedForeground} style={{ marginRight: 6 }} />
              <TextInput
                style={[s.input, { color: colors.foreground }]}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.mutedForeground}
                editable={!isPending}
                returnKeyType="next"
              />
            </View>

            {/* Confirm password */}
            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Confirm New Password</Text>
            <View style={[s.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.mutedForeground} style={{ marginRight: 6 }} />
              <TextInput
                style={[s.input, { color: colors.foreground }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Repeat your new password"
                placeholderTextColor={colors.mutedForeground}
                editable={!isPending}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </View>

            {/* Submit */}
            <Pressable
              style={({ pressed }) => [
                s.submitBtn,
                { backgroundColor: colors.primary, opacity: pressed || isPending ? 0.8 : 1 },
              ]}
              onPress={handleSubmit}
              disabled={isPending}
            >
              {isPending ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={s.submitText}>Set Password & Continue</Text>
              )}
            </Pressable>
          </View>

          {/* Sign out option */}
          <Pressable
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }, s.signOutBtn]}
            onPress={handleSignOut}
          >
            <Text style={[s.signOutText, { color: colors.mutedForeground }]}>Sign out instead</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>,
  insets: ReturnType<typeof import("react-native-safe-area-context").useSafeAreaInsets>
) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flexGrow: 1,
      paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 24,
      paddingBottom: insets.bottom + 40,
      paddingHorizontal: 24,
      justifyContent: "center",
    },
    header: {
      alignItems: "center",
      marginBottom: 32,
    },
    iconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    title: {
      fontSize: 26,
      fontFamily: "Inter_700Bold",
      textAlign: "center",
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      lineHeight: 20,
    },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 20,
      gap: 4,
    },
    fieldLabel: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      marginBottom: 6,
      marginTop: 12,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === "ios" ? 12 : 8,
    },
    input: {
      flex: 1,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
    },
    submitBtn: {
      marginTop: 24,
      paddingVertical: 15,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    submitText: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: "#FFF",
    },
    signOutBtn: {
      alignItems: "center",
      marginTop: 20,
      paddingVertical: 8,
    },
    signOutText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
  });
