import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPersonalHabits,
  useGetSharingHabits,
  useGetSpiritualHabits,
  useLogBearingResult,
  useLogBiblicalNotes,
  useLogCgAttendance,
  useLogGotHabit,
  useLogPersonalHabit,
  useLogSharingAttempt,
  useLogSharingHuddle,
  useLogSharingPreparation,
  useLogSpiritualHabit,
  useLogWorshipAttendance,
} from "@workspace/api-client-react";
import type { PersonalHabit, SpiritualHabitWeek } from "@workspace/api-client-react";
import React, { useEffect, useMemo, useState } from "react";
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

import { useLocalSearchParams } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { rescheduleStreakReminder } from "@/hooks/useStreakReminder";

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

function getTodayIso() {
  return new Date().toISOString().split("T")[0] as string;
}

function isSpiritualWeekOpen(): boolean {
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  sunday.setHours(0, 0, 0, 0);
  const deadline = new Date(sunday);
  deadline.setDate(deadline.getDate() + 7);
  deadline.setHours(7, 30, 0, 0);
  return today <= deadline;
}

const HABIT_INFO: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; freq: string }> = {
  SHC001: { label: "Prayer", icon: "book-outline", freq: "Daily" },
  SHC002: { label: "Devotion", icon: "heart-outline", freq: "Daily" },
  SHC003: { label: "GOT / Treasury", icon: "cash-outline", freq: "Weekly" },
  SHC004: { label: "Worship Attendance", icon: "people-outline", freq: "Weekly" },
  SHC005: { label: "Biblical Notes", icon: "journal-outline", freq: "Weekly" },
  SHC006: { label: "CG Attendance", icon: "home-outline", freq: "Weekly" },
  SHC007: { label: "Sharing Huddle", icon: "megaphone-outline", freq: "Monthly" },
};

const ASPECT_COLORS: Record<string, string> = {
  Physical: "#22C55E",
  Mental: "#3B82F6",
  Financial: "#F59E0B",
  SelfControl: "#8B5CF6",
};

type SubTab = "spiritual" | "personal" | "sharing";

function SubTabBar({ active, onChange }: { active: SubTab; onChange: (t: SubTab) => void }) {
  const colors = useColors();
  const tabs: { key: SubTab; label: string }[] = [
    { key: "spiritual", label: "Spiritual" },
    { key: "personal", label: "Personal" },
    { key: "sharing", label: "Sharing" },
  ];
  return (
    <View style={[tabBarStyles.bar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      {tabs.map((t) => (
        <Pressable
          key={t.key}
          style={[
            tabBarStyles.tab,
            active === t.key && { backgroundColor: colors.primary, borderRadius: 8 },
          ]}
          onPress={() => onChange(t.key)}
        >
          <Text
            style={[
              tabBarStyles.label,
              { color: active === t.key ? colors.primaryForeground : colors.mutedForeground },
            ]}
          >
            {t.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const tabBarStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    margin: 16,
    marginBottom: 0,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});

type HabitDisplayCard = {
  habitCode: string;
  isCompleted: boolean;
  currentStreak: number;
  stellarFragments: number;
};

function buildDisplayCards(data: SpiritualHabitWeek | undefined, todayDayNum: number): HabitDisplayCard[] {
  if (!data) {
    return Object.keys(HABIT_INFO).map((code) => ({
      habitCode: code,
      isCompleted: false,
      currentStreak: 0,
      stellarFragments: 0,
    }));
  }

  const prayerDone = data.prayer.days?.some((d) => d.dayOfWeek === todayDayNum && d.completed) ?? false;
  const devotionDone = data.devotion.days?.some((d) => d.dayOfWeek === todayDayNum && d.completed) ?? false;

  return [
    {
      habitCode: "SHC001",
      isCompleted: prayerDone,
      currentStreak: 0,
      stellarFragments: data.prayer.stellarFragments ?? 0,
    },
    {
      habitCode: "SHC002",
      isCompleted: devotionDone,
      currentStreak: 0,
      stellarFragments: data.devotion.stellarFragments ?? 0,
    },
    {
      habitCode: "SHC003",
      isCompleted: data.got.weekStart != null,
      currentStreak: 0,
      stellarFragments: 0,
    },
    {
      habitCode: "SHC004",
      isCompleted: data.worshipAttendance.attended === true,
      currentStreak: 0,
      stellarFragments: 0,
    },
    {
      habitCode: "SHC005",
      isCompleted: data.biblicalNotes.isDone === true,
      currentStreak: 0,
      stellarFragments: 0,
    },
    {
      habitCode: "SHC006",
      isCompleted: data.cgAttendance.attended === true,
      currentStreak: 0,
      stellarFragments: 0,
    },
    {
      habitCode: "SHC007",
      isCompleted: data.sharingHuddle.attended === true,
      currentStreak: 0,
      stellarFragments: 0,
    },
  ];
}

function on403Alert() {
  Alert.alert(
    "Logging Closed",
    "The submission window for this week has passed. Habits can only be logged until Sunday at 7:30 AM.",
    [{ text: "OK" }],
  );
}

function makeMutationOpts(invalidate: () => void) {
  return {
    onSuccess: invalidate,
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        on403Alert();
      } else {
        Alert.alert("Error", "Could not save your habit. Please try again.", [{ text: "OK" }]);
      }
    },
  };
}

type SubmissionMethod = "eWallet" | "BankTransfer" | "Cash";
type NoteType = "Digital" | "HandWritten";

function SpiritualTab() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const weekStart = useMemo(() => getWeekStart(), []);
  const todayDayNum = useMemo(() => getTodayDayNum(), []);
  const isLocked = useMemo(() => !isSpiritualWeekOpen(), []);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["getSpiritualHabits"] });

  const { data, isLoading } = useGetSpiritualHabits({ weekStart });
  const logDaily = useLogSpiritualHabit({ mutation: makeMutationOpts(invalidate) });
  const logWorship = useLogWorshipAttendance({ mutation: makeMutationOpts(invalidate) });
  const logGot = useLogGotHabit({ mutation: makeMutationOpts(invalidate) });
  const logBiblical = useLogBiblicalNotes({ mutation: makeMutationOpts(invalidate) });
  const logCg = useLogCgAttendance({ mutation: makeMutationOpts(invalidate) });
  const logHuddle = useLogSharingHuddle({ mutation: makeMutationOpts(invalidate) });

  const displayCards = useMemo(() => buildDisplayCards(data, todayDayNum), [data, todayDayNum]);

  const prayerDone = displayCards.find((c) => c.habitCode === "SHC001")?.isCompleted ?? false;
  const devotionDone = displayCards.find((c) => c.habitCode === "SHC002")?.isCompleted ?? false;

  useEffect(() => {
    if (prayerDone && devotionDone) {
      rescheduleStreakReminder();
    }
  }, [prayerDone, devotionDone]);

  const [gotModalVisible, setGotModalVisible] = useState(false);
  const [gotGift, setGotGift] = useState("");
  const [gotOffering, setGotOffering] = useState("");
  const [gotTithes, setGotTithes] = useState("");
  const [gotMethod, setGotMethod] = useState<SubmissionMethod | null>(null);

  const [biblicalModalVisible, setBiblicalModalVisible] = useState(false);
  const [biblicalNoteType, setBiblicalNoteType] = useState<NoteType | null>(null);

  function resetGotForm() {
    setGotGift("");
    setGotOffering("");
    setGotTithes("");
    setGotMethod(null);
  }

  function submitGot(withDetails: boolean) {
    setGotModalVisible(false);
    const payload = withDetails
      ? {
          weekStart,
          submitted: true,
          giftAmount: gotGift ? parseFloat(gotGift) : null,
          offeringAmount: gotOffering ? parseFloat(gotOffering) : null,
          tithesAmount: gotTithes ? parseFloat(gotTithes) : null,
          submissionMethod: gotMethod ?? null,
        }
      : { weekStart, submitted: true };
    resetGotForm();
    logGot.mutate({ data: payload });
  }

  function submitBiblical(withDetails: boolean) {
    setBiblicalModalVisible(false);
    const payload = withDetails && biblicalNoteType
      ? { weekStart, isDone: true, noteType: biblicalNoteType }
      : { weekStart, isDone: true };
    setBiblicalNoteType(null);
    logBiblical.mutate({ data: payload });
  }

  function handleLog(code: string) {
    if (isLocked) {
      on403Alert();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (code === "SHC001" || code === "SHC002") {
      logDaily.mutate({
        data: {
          habitCode: code,
          weekStart,
          days: [{ dayOfWeek: todayDayNum, completed: true, compliant: true, committed: true }],
          totalDuration: 0,
        },
      });
    } else if (code === "SHC004") {
      logWorship.mutate({ data: { weekStart, attended: true } });
    } else if (code === "SHC003") {
      setGotModalVisible(true);
    } else if (code === "SHC005") {
      setBiblicalModalVisible(true);
    } else if (code === "SHC006") {
      logCg.mutate({ data: { weekStart, attended: true } });
    } else if (code === "SHC007") {
      logHuddle.mutate({ data: { weekStart, attended: true } });
    }
  }

  if (isLoading) {
    return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
  }

  const SUB_METHODS: { value: SubmissionMethod; label: string }[] = [
    { value: "eWallet", label: "e-Wallet" },
    { value: "BankTransfer", label: "Bank Transfer" },
    { value: "Cash", label: "Cash" },
  ];

  const NOTE_TYPES: { value: NoteType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: "Digital", label: "Digital", icon: "phone-portrait-outline" },
    { value: "HandWritten", label: "Handwritten", icon: "pencil-outline" },
  ];

  return (
    <View style={{ gap: 10, padding: 16 }}>
      <Modal
        visible={gotModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => submitGot(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={modalStyles.overlay}
        >
          <Pressable style={modalStyles.backdrop} onPress={() => submitGot(false)} />
          <View style={[modalStyles.sheet, { backgroundColor: colors.card }]}>
            <View style={[modalStyles.handle, { backgroundColor: colors.border }]} />
            <Text style={[modalStyles.sheetTitle, { color: colors.foreground }]}>GOT / Treasury</Text>
            <Text style={[modalStyles.sheetSubtitle, { color: colors.mutedForeground }]}>
              Enter your treasury amounts (optional)
            </Text>

            {(["Gift", "Offering", "Tithes"] as const).map((label) => {
              const stateMap = { Gift: gotGift, Offering: gotOffering, Tithes: gotTithes };
              const setterMap = { Gift: setGotGift, Offering: setGotOffering, Tithes: setGotTithes };
              return (
                <View key={label} style={modalStyles.fieldRow}>
                  <Text style={[modalStyles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  <TextInput
                    style={[modalStyles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
                    placeholder="0.00"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                    value={stateMap[label]}
                    onChangeText={setterMap[label]}
                  />
                </View>
              );
            })}

            <Text style={[modalStyles.fieldLabel, { color: colors.mutedForeground, marginTop: 8 }]}>Submission Method</Text>
            <View style={modalStyles.segmentRow}>
              {SUB_METHODS.map((m) => (
                <Pressable
                  key={m.value}
                  style={[
                    modalStyles.segmentBtn,
                    { borderColor: colors.border, backgroundColor: gotMethod === m.value ? colors.primary : colors.secondary },
                  ]}
                  onPress={() => setGotMethod(gotMethod === m.value ? null : m.value)}
                >
                  <Text style={[modalStyles.segmentText, { color: gotMethod === m.value ? colors.primaryForeground : colors.foreground }]}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={modalStyles.btnRow}>
              <Pressable
                style={[modalStyles.skipBtn, { borderColor: colors.border }]}
                onPress={() => { setGotModalVisible(false); resetGotForm(); submitGot(false); }}
              >
                <Text style={[modalStyles.skipText, { color: colors.mutedForeground }]}>Skip Details</Text>
              </Pressable>
              <Pressable
                style={[modalStyles.submitBtn, { backgroundColor: colors.primary }]}
                onPress={() => submitGot(true)}
              >
                <Text style={[modalStyles.submitText, { color: colors.primaryForeground }]}>Submit</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={biblicalModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => submitBiblical(false)}
      >
        <Pressable style={modalStyles.overlay} onPress={() => submitBiblical(false)}>
          <View style={modalStyles.backdrop} />
        </Pressable>
        <View style={[modalStyles.sheet, { backgroundColor: colors.card, position: "absolute", bottom: 0, left: 0, right: 0 }]}>
          <View style={[modalStyles.handle, { backgroundColor: colors.border }]} />
          <Text style={[modalStyles.sheetTitle, { color: colors.foreground }]}>Biblical Notes</Text>
          <Text style={[modalStyles.sheetSubtitle, { color: colors.mutedForeground }]}>
            How did you take your notes this week?
          </Text>

          <View style={[modalStyles.segmentRow, { marginTop: 4 }]}>
            {NOTE_TYPES.map((nt) => (
              <Pressable
                key={nt.value}
                style={[
                  modalStyles.noteTypeBtn,
                  { borderColor: biblicalNoteType === nt.value ? colors.primary : colors.border, backgroundColor: biblicalNoteType === nt.value ? colors.primary + "15" : colors.secondary },
                ]}
                onPress={() => setBiblicalNoteType(biblicalNoteType === nt.value ? null : nt.value)}
              >
                <Ionicons name={nt.icon} size={22} color={biblicalNoteType === nt.value ? colors.primary : colors.mutedForeground} />
                <Text style={[modalStyles.noteTypeText, { color: biblicalNoteType === nt.value ? colors.primary : colors.foreground }]}>
                  {nt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={modalStyles.btnRow}>
            <Pressable
              style={[modalStyles.skipBtn, { borderColor: colors.border }]}
              onPress={() => submitBiblical(false)}
            >
              <Text style={[modalStyles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
            </Pressable>
            <Pressable
              style={[modalStyles.submitBtn, { backgroundColor: colors.primary }]}
              onPress={() => submitBiblical(true)}
            >
              <Text style={[modalStyles.submitText, { color: colors.primaryForeground }]}>Submit</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {isLocked && (
        <View style={[spirStyles.closedBanner, { backgroundColor: "#F59E0B20", borderColor: "#F59E0B60" }]}>
          <Ionicons name="lock-closed-outline" size={16} color="#F59E0B" />
          <Text style={[spirStyles.closedBannerText, { color: "#F59E0B" }]}>
            This week is closed — logging ended Sunday at 7:30 AM
          </Text>
        </View>
      )}
      {displayCards.map((card) => {
        const code = card.habitCode;
        const info = HABIT_INFO[code];
        if (!info) return null;
        const done = card.isCompleted;
        const streak = card.currentStreak;
        const frags = card.stellarFragments;
        return (
          <View
            key={code}
            style={[
              spirStyles.card,
              { backgroundColor: colors.card, borderColor: done ? colors.primary + "60" : colors.border },
            ]}
          >
            <View
              style={[
                spirStyles.iconBox,
                { backgroundColor: done ? colors.primary + "20" : colors.secondary },
              ]}
            >
              <Ionicons name={info.icon} size={22} color={done ? colors.primary : colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[spirStyles.label, { color: colors.foreground }]}>{info.label}</Text>
                <View style={[spirStyles.freqBadge, { backgroundColor: colors.secondary }]}>
                  <Text style={[spirStyles.freqText, { color: colors.mutedForeground }]}>{info.freq}</Text>
                </View>
              </View>
              {(streak > 0 || frags > 0) && (
                <Text style={[spirStyles.meta, { color: colors.mutedForeground }]}>
                  {streak > 0 ? `${streak} week streak` : ""}
                  {streak > 0 && frags > 0 ? " · " : ""}
                  {frags > 0 ? `${frags} frags` : ""}
                </Text>
              )}
            </View>
            {done ? (
              <View style={[spirStyles.donePill, { backgroundColor: colors.primary + "20" }]}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={[spirStyles.doneLabel, { color: colors.primary }]}>Done</Text>
              </View>
            ) : isLocked ? (
              <View style={[spirStyles.donePill, { backgroundColor: "#F59E0B20" }]}>
                <Ionicons name="lock-closed" size={14} color="#F59E0B" />
                <Text style={[spirStyles.doneLabel, { color: "#F59E0B" }]}>Closed</Text>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  spirStyles.logBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => handleLog(code)}
              >
                <Text style={[spirStyles.logBtnText, { color: colors.primaryForeground }]}>Log</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

const spirStyles = StyleSheet.create({
  closedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  closedBannerText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  freqBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  freqText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  meta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  donePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  doneLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  logBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  logBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  sheetSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  segmentText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  noteTypeBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    gap: 6,
  },
  noteTypeText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  skipText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  submitText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
});

function PersonalTab() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetPersonalHabits();
  const [habitErrors, setHabitErrors] = useState<Record<number, string>>({});

  const setHabitError = (id: number, msg: string) =>
    setHabitErrors((prev) => ({ ...prev, [id]: msg }));
  const clearHabitError = (id: number) =>
    setHabitErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });

  const logHabit = useLogPersonalHabit({
    mutation: {
      onSuccess: (_data, vars) => {
        clearHabitError(vars.id);
        queryClient.invalidateQueries({ queryKey: ["/api/habits/personal"] });
      },
      onError: (err: unknown, vars) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          "Could not log habit. Please try again.";
        setHabitError(vars.id, msg);
      },
    },
  });

  const habits: PersonalHabit[] = data ?? [];

  if (isLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;

  if (habits.length === 0) {
    return (
      <View style={persStyles.empty}>
        <Ionicons name="fitness-outline" size={40} color={colors.mutedForeground} />
        <Text style={[persStyles.emptyTitle, { color: colors.foreground }]}>No Personal Habits</Text>
        <Text style={[persStyles.emptyText, { color: colors.mutedForeground }]}>
          Personal habits can be added on Sundays 8AM–8PM (PHOW window).
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 10, padding: 16 }}>
      {habits.map((habit) => {
        const id = habit.id;
        const name = habit.habitName;
        const aspect = habit.aspect;
        const streak = habit.currentStreak ?? 0;
        const frags = habit.stellarFragments ?? 0;
        const freq = habit.frequency;
        const accentColor = ASPECT_COLORS[aspect] ?? colors.primary;
        const errorMsg = habitErrors[id];

        return (
          <View key={id} style={{ gap: 4 }}>
            <View
              style={[persStyles.card, { backgroundColor: colors.card, borderColor: errorMsg ? "#ef4444" : colors.border }]}
            >
              <View style={[persStyles.aspectBar, { backgroundColor: accentColor }]} />
              <View style={{ flex: 1, gap: 4, paddingVertical: 14 }}>
                <Text style={[persStyles.name, { color: colors.foreground }]}>{name}</Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {aspect ? (
                    <Text style={[persStyles.badge, { color: accentColor }]}>{aspect}</Text>
                  ) : null}
                  {freq ? (
                    <Text style={[persStyles.badge, { color: colors.mutedForeground }]}>{freq}</Text>
                  ) : null}
                  {streak > 0 && (
                    <Text style={[persStyles.badge, { color: colors.primary }]}>{streak} streak</Text>
                  )}
                </View>
                {frags > 0 && (
                  <Text style={[persStyles.frags, { color: colors.mutedForeground }]}>✦ {frags} fragments</Text>
                )}
              </View>
              <Pressable
                style={({ pressed }) => [
                  persStyles.logBtn,
                  { backgroundColor: accentColor, opacity: pressed ? 0.8 : 1, marginRight: 14 },
                ]}
                onPress={() => {
                  const today = getTodayIso();
                  const createdDate = habit.createdAt.split("T")[0] as string;

                  if (today < createdDate) {
                    setHabitError(id, `This habit was created on ${createdDate}. You cannot log it for an earlier date.`);
                    return;
                  }

                  clearHabitError(id);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  logHabit.mutate({
                    id,
                    data: { logDate: today, completed: true },
                  });
                }}
                disabled={logHabit.isPending}
              >
                <Text style={[persStyles.logBtnText, { color: "#FFFFFF" }]}>Log</Text>
              </Pressable>
            </View>
            {errorMsg ? (
              <Text style={[persStyles.errorText, { color: "#ef4444" }]}>{errorMsg}</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const persStyles = StyleSheet.create({
  empty: { alignItems: "center", padding: 40, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  aspectBar: { width: 4, alignSelf: "stretch" },
  name: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  badge: { fontSize: 11, fontFamily: "Inter_500Medium" },
  frags: { fontSize: 11, fontFamily: "Inter_400Regular" },
  logBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  logBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular", paddingHorizontal: 4 },
});

function SharingTab() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetSharingHabits();
  const logPrep = useLogSharingPreparation({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["getSharingHabits"] }) },
  });
  const logAttempt = useLogSharingAttempt({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["getSharingHabits"] });
        setAttemptModalVisible(false);
        setAttemptName("");
        setAttemptError("");
      },
      onError: () => {
        Alert.alert("Error", "Could not log attempt. Please try again.", [{ text: "OK" }]);
      },
    },
  });
  const logBearing = useLogBearingResult({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["getSharingHabits"] });
        setBearingModalVisible(false);
        setBearingName("");
        setBearingError("");
      },
      onError: () => {
        Alert.alert("Error", "Could not log bearing. Please try again.", [{ text: "OK" }]);
      },
    },
  });

  const weekStart = useMemo(() => getWeekStart(), []);
  const todayIso = useMemo(() => getTodayIso(), []);

  const [attemptModalVisible, setAttemptModalVisible] = useState(false);
  const [attemptName, setAttemptName] = useState("");
  const [attemptError, setAttemptError] = useState("");

  const [bearingModalVisible, setBearingModalVisible] = useState(false);
  const [bearingName, setBearingName] = useState("");
  const [bearingError, setBearingError] = useState("");

  function handleAttemptSubmit() {
    const trimmed = attemptName.trim();
    if (!trimmed) {
      setAttemptError("Please enter the person's name.");
      return;
    }
    setAttemptError("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    logAttempt.mutate({ data: { attemptDate: todayIso, targetName: trimmed } });
  }

  function handleBearingSubmit() {
    const trimmed = bearingName.trim();
    if (!trimmed) {
      setBearingError("Please enter the believer's name.");
      return;
    }
    setBearingError("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    logBearing.mutate({ data: { bearingDate: todayIso, believerName: trimmed } });
  }

  const preps = data?.preparations.length ?? 0;
  const attempts = data?.attempts.length ?? 0;
  const bearings = data?.bearings.length ?? 0;

  if (isLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;

  const tiers = [
    {
      level: 1,
      title: "Preparation",
      subtitle: "Gospel sharing prep",
      icon: "book-outline" as keyof typeof Ionicons.glyphMap,
      count: preps,
      color: "#3B82F6",
      onLog: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        logPrep.mutate({ data: { weekStart } });
      },
      loading: logPrep.isPending,
    },
    {
      level: 2,
      title: "Attempt",
      subtitle: "Shared with someone",
      icon: "chatbubble-outline" as keyof typeof Ionicons.glyphMap,
      count: attempts,
      color: "#F59E0B",
      onLog: () => {
        setAttemptName("");
        setAttemptError("");
        setAttemptModalVisible(true);
      },
      loading: logAttempt.isPending,
    },
    {
      level: 3,
      title: "Bearing",
      subtitle: "Someone received Christ",
      icon: "heart-outline" as keyof typeof Ionicons.glyphMap,
      count: bearings,
      color: "#22C55E",
      onLog: () => {
        setBearingName("");
        setBearingError("");
        setBearingModalVisible(true);
      },
      loading: logBearing.isPending,
    },
  ];

  return (
    <View style={{ gap: 12, padding: 16 }}>
      <Modal
        visible={attemptModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setAttemptModalVisible(false); setAttemptError(""); }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={modalStyles.overlay}>
          <Pressable style={modalStyles.backdrop} onPress={() => { setAttemptModalVisible(false); setAttemptError(""); }} />
          <View style={[modalStyles.sheet, { backgroundColor: colors.card }]}>
            <View style={[modalStyles.handle, { backgroundColor: colors.border }]} />
            <Text style={[modalStyles.sheetTitle, { color: colors.foreground }]}>Log Sharing Attempt</Text>
            <Text style={[modalStyles.sheetSubtitle, { color: colors.mutedForeground }]}>
              Who did you share the Gospel with?
            </Text>
            <TextInput
              style={[
                shareStyles.nameInput,
                {
                  backgroundColor: colors.secondary,
                  color: colors.foreground,
                  borderColor: attemptError ? "#ef4444" : colors.border,
                },
              ]}
              placeholder="Enter their name"
              placeholderTextColor={colors.mutedForeground}
              value={attemptName}
              onChangeText={(t) => { setAttemptName(t); if (attemptError) setAttemptError(""); }}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleAttemptSubmit}
            />
            {!!attemptError && (
              <Text style={[shareStyles.errorText, { color: "#ef4444" }]}>{attemptError}</Text>
            )}
            <View style={modalStyles.btnRow}>
              <Pressable
                style={[modalStyles.skipBtn, { borderColor: colors.border }]}
                onPress={() => { setAttemptModalVisible(false); setAttemptError(""); }}
              >
                <Text style={[modalStyles.skipText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[modalStyles.submitBtn, { backgroundColor: "#F59E0B", opacity: logAttempt.isPending ? 0.7 : 1 }]}
                onPress={handleAttemptSubmit}
                disabled={logAttempt.isPending}
              >
                {logAttempt.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[modalStyles.submitText, { color: "#FFFFFF" }]}>Log Attempt</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={bearingModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setBearingModalVisible(false); setBearingError(""); }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={modalStyles.overlay}>
          <Pressable style={modalStyles.backdrop} onPress={() => { setBearingModalVisible(false); setBearingError(""); }} />
          <View style={[modalStyles.sheet, { backgroundColor: colors.card }]}>
            <View style={[modalStyles.handle, { backgroundColor: colors.border }]} />
            <Text style={[modalStyles.sheetTitle, { color: colors.foreground }]}>Log Bearing Result</Text>
            <Text style={[modalStyles.sheetSubtitle, { color: colors.mutedForeground }]}>
              What is the name of the new believer?
            </Text>
            <TextInput
              style={[
                shareStyles.nameInput,
                {
                  backgroundColor: colors.secondary,
                  color: colors.foreground,
                  borderColor: bearingError ? "#ef4444" : colors.border,
                },
              ]}
              placeholder="Enter their name"
              placeholderTextColor={colors.mutedForeground}
              value={bearingName}
              onChangeText={(t) => { setBearingName(t); if (bearingError) setBearingError(""); }}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleBearingSubmit}
            />
            {!!bearingError && (
              <Text style={[shareStyles.errorText, { color: "#ef4444" }]}>{bearingError}</Text>
            )}
            <View style={modalStyles.btnRow}>
              <Pressable
                style={[modalStyles.skipBtn, { borderColor: colors.border }]}
                onPress={() => { setBearingModalVisible(false); setBearingError(""); }}
              >
                <Text style={[modalStyles.skipText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[modalStyles.submitBtn, { backgroundColor: "#22C55E", opacity: logBearing.isPending ? 0.7 : 1 }]}
                onPress={handleBearingSubmit}
                disabled={logBearing.isPending}
              >
                {logBearing.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[modalStyles.submitText, { color: "#FFFFFF" }]}>Log Bearing</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Text style={[shareStyles.intro, { color: colors.mutedForeground }]}>
        Track your Gospel sharing journey across 3 levels.
      </Text>
      {tiers.map((tier) => (
        <View
          key={tier.level}
          style={[shareStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={[shareStyles.levelBadge, { backgroundColor: tier.color + "20" }]}>
            <Text style={[shareStyles.levelNum, { color: tier.color }]}>{tier.level}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[shareStyles.title, { color: colors.foreground }]}>{tier.title}</Text>
            <Text style={[shareStyles.subtitle, { color: colors.mutedForeground }]}>{tier.subtitle}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
              <Ionicons name={tier.icon} size={14} color={tier.color} />
              <Text style={[shareStyles.count, { color: tier.color }]}>
                {tier.count} logged
              </Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              shareStyles.logBtn,
              { backgroundColor: tier.color, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={tier.onLog}
            disabled={tier.loading}
          >
            {tier.loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={shareStyles.logBtnText}>Log</Text>
            )}
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const shareStyles = StyleSheet.create({
  intro: { fontSize: 13, fontFamily: "Inter_400Regular" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  levelBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  levelNum: { fontSize: 18, fontFamily: "Inter_700Bold" },
  title: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  count: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  logBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  logBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  nameInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});

export default function DiscipleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { subTab: subTabParam } = useLocalSearchParams<{ subTab?: string }>();
  const [activeTab, setActiveTab] = useState<SubTab>("spiritual");

  useEffect(() => {
    if (
      subTabParam === "spiritual" ||
      subTabParam === "personal" ||
      subTabParam === "sharing"
    ) {
      setActiveTab(subTabParam);
    }
  }, [subTabParam]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[dStyles.header, { paddingTop: topPad + 16, backgroundColor: colors.navBackground }]}>
        <Text style={dStyles.title}>Disciple Hub</Text>
        <Text style={dStyles.subtitle}>Track your discipleship journey</Text>
      </View>

      <SubTabBar active={activeTab} onChange={setActiveTab} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "spiritual" && <SpiritualTab />}
        {activeTab === "personal" && <PersonalTab />}
        {activeTab === "sharing" && <SharingTab />}
      </ScrollView>
    </View>
  );
}

const dStyles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
});
