import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useChangePassword } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const STELLAR_LABELS: Record<string, string> = {
  SBG: "Stellar Beginner",
  P2S: "Prepared to Serve",
  S2B: "Servant to Beacon",
  P2G: "Pillar to Gem",
};

function ProfileRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={[rowStyles.row, { borderBottomColor: colors.border }]}>
      <View style={[rowStyles.iconBox, { backgroundColor: colors.secondary }]}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[rowStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[rowStyles.value, { color: colors.foreground }]}>{value || "—"}</Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 11, fontFamily: "Inter_400Regular" },
  value: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 1 },
});

function ChangePasswordModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { mutateAsync: changePassword, isPending } = useChangePassword();

  function resetForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

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
    if (newPassword !== confirmPassword) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Mismatch", "New password and confirmation do not match.");
      return;
    }
    try {
      await changePassword({ data: { currentPassword, newPassword } });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Password Changed", "Your password has been updated successfully.", [
        { text: "OK", onPress: handleClose },
      ]);
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to change password. Make sure your current password is correct.");
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={handleClose}>
      <View style={m.overlay}>
        <KeyboardAvoidingView
          style={{ width: "100%", maxWidth: 440, alignSelf: "center" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[m.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
            {/* Handle */}
            <View style={[m.handle, { backgroundColor: colors.border }]} />

            {/* Title row */}
            <View style={m.titleRow}>
              <Text style={[m.title, { color: colors.foreground }]}>Change Password</Text>
              <Pressable onPress={handleClose} hitSlop={12}>
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <Text style={[m.subtitle, { color: colors.mutedForeground }]}>
              Enter your current password, then choose a new one.
            </Text>

            {/* Current password */}
            <Text style={[m.fieldLabel, { color: colors.mutedForeground }]}>Current Password</Text>
            <View style={[m.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.mutedForeground} style={{ marginRight: 6 }} />
              <TextInput
                style={[m.input, { color: colors.foreground }]}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Current password"
                placeholderTextColor={colors.mutedForeground}
                editable={!isPending}
              />
            </View>

            {/* New password */}
            <Text style={[m.fieldLabel, { color: colors.mutedForeground }]}>New Password</Text>
            <View style={[m.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Ionicons name="key-outline" size={16} color={colors.mutedForeground} style={{ marginRight: 6 }} />
              <TextInput
                style={[m.input, { color: colors.foreground }]}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="New password (min 6 chars)"
                placeholderTextColor={colors.mutedForeground}
                editable={!isPending}
              />
            </View>

            {/* Confirm password */}
            <Text style={[m.fieldLabel, { color: colors.mutedForeground }]}>Confirm New Password</Text>
            <View style={[m.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.mutedForeground} style={{ marginRight: 6 }} />
              <TextInput
                style={[m.input, { color: colors.foreground }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Repeat new password"
                placeholderTextColor={colors.mutedForeground}
                editable={!isPending}
                onSubmitEditing={handleSubmit}
                returnKeyType="done"
              />
            </View>

            {/* Submit */}
            <Pressable
              style={({ pressed }) => [
                m.submitBtn,
                { backgroundColor: colors.primary, opacity: pressed || isPending ? 0.8 : 1 },
              ]}
              onPress={handleSubmit}
              disabled={isPending}
            >
              {isPending ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={m.submitText}>Update Password</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const m = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 0,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 6,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 4,
    marginTop: 8,
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
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#FFF",
  },
});

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { member, logout, isLoading } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);

  const m2 = member as Record<string, unknown> | null;

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  function handleLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logout();
          router.replace("/login");
        },
      },
    ]);
  }

  if (isLoading || !member) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const name = (m2?.["name"] as string) ?? "Member";
  const churchId = (m2?.["churchId"] as string) ?? "";
  const accountType = (m2?.["accountType"] as string) ?? "PCM";
  const accountStatus = (m2?.["accountStatus"] as string) ?? "Active";
  const stellarStatus = (m2?.["stellarStatus"] as string) ?? "SBG";
  const role = (m2?.["role"] as string) ?? "Member";
  const email = (m2?.["email"] as string) ?? "";
  const phone = (m2?.["phone"] as string) ?? "";
  const fragments = (m2?.["stellarFragments"] as number) ?? 0;
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <ChangePasswordModal
        visible={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[s.header, { paddingTop: topPad + 16, backgroundColor: colors.navBackground }]}>
          <View style={[s.avatar, { backgroundColor: colors.primary }]}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <Text style={s.name}>{name}</Text>
          <Text style={s.churchId}>{churchId}</Text>
          <View style={[s.roleBadge, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
            <Text style={s.roleText}>{role}</Text>
          </View>
        </View>

        <View style={{ padding: 16, gap: 16 }}>
          {/* Fragment Summary */}
          <View style={[s.fragCard, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}>
            <Ionicons name="star" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[s.fragValue, { color: colors.primary }]}>{fragments.toLocaleString()}</Text>
              <Text style={[s.fragLabel, { color: colors.mutedForeground }]}>Stellar Fragments</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[s.statusLabel, { color: colors.primary }]}>
                {STELLAR_LABELS[stellarStatus] ?? stellarStatus}
              </Text>
              <Text style={[s.statusSub, { color: colors.mutedForeground }]}>{accountType}</Text>
            </View>
          </View>

          {/* Info Card */}
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Account Info</Text>
            <ProfileRow icon="id-card-outline" label="Church ID" value={churchId} />
            <ProfileRow icon="shield-checkmark-outline" label="Account Status" value={accountStatus} />
            <ProfileRow icon="star-outline" label="Stellar Status" value={STELLAR_LABELS[stellarStatus] ?? stellarStatus} />
            <ProfileRow icon="person-outline" label="Role" value={role} />
            {email ? <ProfileRow icon="mail-outline" label="Email" value={email} /> : null}
            {phone ? <ProfileRow icon="call-outline" label="Phone" value={phone} /> : null}
          </View>

          {/* Security Card */}
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Security</Text>
            <Pressable
              style={({ pressed }) => [s.actionRow, { borderBottomWidth: 0, opacity: pressed ? 0.7 : 1 }]}
              onPress={() => setShowChangePassword(true)}
            >
              <View style={[rowStyles.iconBox, { backgroundColor: colors.secondary }]}>
                <Ionicons name="key-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.actionLabel, { color: colors.foreground }]}>Change Password</Text>
                <Text style={[s.actionSub, { color: colors.mutedForeground }]}>Update your account password</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Logout */}
          <Pressable
            style={({ pressed }) => [
              s.logoutBtn,
              { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "40", opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
            <Text style={[s.logoutText, { color: colors.destructive }]}>Sign Out</Text>
          </Pressable>

          <Text style={[s.version, { color: colors.mutedForeground }]}>Stellify Mobile · Press Church</Text>
        </View>
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 6,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  name: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  churchId: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
  },
  roleBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 4,
  },
  roleText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  fragCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  fragValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  fragLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statusLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  statusSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  actionLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  actionSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  logoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  version: {
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
