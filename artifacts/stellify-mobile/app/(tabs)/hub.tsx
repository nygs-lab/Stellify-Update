import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetDashboardSummary,
  useGetSpiritualHabits,
  useLogSpiritualHabit,
} from "@workspace/api-client-react";
import type { SpiritualHabitLogInputHabitCode } from "@workspace/api-client-react";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const STELLAR_LABELS: Record<string, string> = {
  SBG: "Stellar Beginner",
  P2S: "Prepared to Serve",
  S2B: "Servant to Beacon",
  P2G: "Pillar to Gem",
};

const STELLAR_STARS: Record<string, number> = {
  SBG: 1,
  P2S: 2,
  S2B: 3,
  P2G: 4,
};

function getWeekStart() {
  const today = new Date();
  const day = today.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + offset);
  return monday.toISOString().split("T")[0] as string;
}

function getTodayDayNum() {
  return new Date().getDay();
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function StellarStars({ status }: { status: string }) {
  const colors = useColors();
  const count = STELLAR_STARS[status] ?? 1;
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {[1, 2, 3, 4].map((i) => (
        <Ionicons
          key={i}
          name={i <= count ? "star" : "star-outline"}
          size={20}
          color={i <= count ? colors.primary : colors.mutedForeground}
        />
      ))}
    </View>
  );
}

function QuickHabitCard({
  title,
  icon,
  done,
  onLog,
  loading,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  done: boolean;
  onLog: () => void;
  loading: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        quickStyles.card,
        {
          backgroundColor: done ? colors.primary + "20" : colors.card,
          borderColor: done ? colors.primary : colors.border,
        },
      ]}
    >
      <View
        style={[
          quickStyles.iconCircle,
          { backgroundColor: done ? colors.primary : colors.secondary },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={done ? "#fff" : colors.primary} />
        ) : (
          <Ionicons
            name={done ? "checkmark" : icon}
            size={20}
            color={done ? "#fff" : colors.primary}
          />
        )}
      </View>
      <Text
        style={[quickStyles.title, { color: colors.foreground }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {!done && (
        <Pressable
          style={[quickStyles.logBtn, { backgroundColor: colors.primary }]}
          onPress={onLog}
          disabled={loading}
          hitSlop={8}
        >
          <Text style={[quickStyles.logBtnText, { color: colors.primaryForeground }]}>Log</Text>
        </Pressable>
      )}
      {done && (
        <Text style={[quickStyles.doneText, { color: colors.primary }]}>Done</Text>
      )}
    </View>
  );
}

const quickStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 8,
    minHeight: 120,
    justifyContent: "center",
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  logBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  logBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  doneText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});

export default function HubScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { member } = useAuth();
  const queryClient = useQueryClient();

  const weekStart = useMemo(() => getWeekStart(), []);
  const todayDayNum = useMemo(() => getTodayDayNum(), []);

  const dashQuery = useGetDashboardSummary();
  const habitsQuery = useGetSpiritualHabits({ weekStart });
  const logMutation = useLogSpiritualHabit({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["getSpiritualHabits"] });
        queryClient.invalidateQueries({ queryKey: ["getDashboardSummary"] });
      },
    },
  });

  const dash = dashQuery.data;
  const habitsData = habitsQuery.data;

  const prayerDone = habitsData?.prayer.days?.some(
    (d) => d.dayOfWeek === todayDayNum && d.completed
  ) ?? false;
  const devotionDone = habitsData?.devotion.days?.some(
    (d) => d.dayOfWeek === todayDayNum && d.completed
  ) ?? false;

  function logHabit(habitCode: SpiritualHabitLogInputHabitCode) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    logMutation.mutate({
      data: {
        habitCode,
        weekStart,
        days: [{ dayOfWeek: todayDayNum, completed: true, compliant: true, committed: true }],
        totalDuration: 0,
      },
    });
  }

  const isLoggingPrayer = logMutation.isPending &&
    logMutation.variables?.data?.habitCode === "SHC001";
  const isLoggingDevotion = logMutation.isPending &&
    logMutation.variables?.data?.habitCode === "SHC002";

  const stellarStatus = member?.stellarStatus ?? "SBG";
  const firstName = member?.firstName ?? "Member";
  const fragments = dash?.stellarFragments ?? 0;
  const weekStreak = dash?.streakDays ?? 0;
  const excoDays = dash?.daysRemaining ?? null;

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  if (dashQuery.isLoading && habitsQuery.isLoading && !member) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      refreshControl={
        <RefreshControl
          refreshing={dashQuery.isFetching || habitsQuery.isFetching}
          onRefresh={() => {
            dashQuery.refetch();
            habitsQuery.refetch();
          }}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 20, backgroundColor: colors.navBackground },
        ]}
      >
        <View>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.name}>{firstName}</Text>
        </View>
        <View style={styles.churchIdBadge}>
          <Text style={styles.churchIdText}>
            {member?.churchId ?? ""}
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Excommunication Warning */}
        {excoDays !== null && excoDays >= 0 && (
          <View style={[styles.warningCard, { backgroundColor: colors.destructive + "20", borderColor: colors.destructive }]}>
            <Ionicons name="warning" size={18} color={colors.destructive} />
            <Text style={[styles.warningText, { color: colors.destructive }]}>
              {excoDays === 0
                ? "Excommunication today — log a habit now!"
                : `${excoDays} day${excoDays === 1 ? "" : "s"} until excommunication`}
            </Text>
          </View>
        )}

        {/* Stellar Status Card */}
        <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statusTop}>
            <View>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>STELLAR STATUS</Text>
              <Text style={[styles.statusName, { color: colors.foreground }]}>
                {STELLAR_LABELS[stellarStatus] ?? stellarStatus}
              </Text>
            </View>
            <StellarStars status={stellarStatus} />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {fragments.toLocaleString()}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Fragments</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {weekStreak > 0 ? weekStreak : "—"}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Week Streak</Text>
            </View>
          </View>
        </View>

        {/* Today's Habits */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Today's Habits</Text>
        {habitsQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
        ) : (
          <View style={styles.habitRow}>
            <QuickHabitCard
              title="Prayer"
              icon="book-outline"
              done={prayerDone}
              onLog={() => logHabit("SHC001")}
              loading={!!isLoggingPrayer}
            />
            <QuickHabitCard
              title="Devotion"
              icon="heart-outline"
              done={devotionDone}
              onLog={() => logHabit("SHC002")}
              loading={!!isLoggingDevotion}
            />
          </View>
        )}

        {/* Member Status */}
        <View style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.memberRow}>
            <Ionicons name="person-circle-outline" size={20} color={colors.mutedForeground} />
            <Text style={[styles.memberLabel, { color: colors.mutedForeground }]}>Account Type</Text>
            <Text style={[styles.memberValue, { color: colors.foreground }]}>
              {member?.accountType ?? "PCM"}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.memberRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.mutedForeground} />
            <Text style={[styles.memberLabel, { color: colors.mutedForeground }]}>Status</Text>
            <Text style={[styles.memberValue, { color: colors.foreground }]}>
              {member?.status ?? "Active"}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  greeting: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
  },
  name: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  churchIdBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  churchIdText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  content: { padding: 16, gap: 16 },
  warningCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  warningText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  statusCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  statusTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  statusName: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  divider: { height: 1, marginVertical: 14 },
  statsRow: { flexDirection: "row" },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 24, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  statDivider: { width: 1, marginHorizontal: 8 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  habitRow: { flexDirection: "row", gap: 12 },
  memberCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  memberLabel: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1 },
  memberValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
