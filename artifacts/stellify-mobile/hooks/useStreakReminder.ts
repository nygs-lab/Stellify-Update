/**
 * Streak reminder: schedules nightly notifications to prompt Prayer & Devotion.
 *
 * Two scheduling modes:
 *  - Habits incomplete → DAILY 8PM recurring trigger (fires every night
 *    without the app reopening).
 *  - Habits complete today → one-shot DATE trigger for tomorrow at 8PM
 *    (suppresses tonight's notification so compliant members aren't nagged).
 *
 * `syncStreakReminder()` is the single source of truth. It cancels whatever
 * is currently scheduled and picks the correct trigger based on today's
 * habit status. Called on login, every foreground transition, and immediately
 * after permission is granted.
 *
 * `rescheduleStreakReminder()` is the fast-path for the Spiritual tab: when
 * both habits are just ticked off in the UI, it immediately cancels tonight's
 * notification and schedules the one-shot for tomorrow without waiting for the
 * next `syncStreakReminder` cycle.
 *
 * All day-boundary calculations use the device's IANA timezone
 * (`Intl.DateTimeFormat().resolvedOptions().timeZone`) so they are correct
 * for members whose device timezone differs from the server's UTC clock.
 * The resolved timezone is also persisted to the member profile on login via
 * `syncTimezone()` so that any future server-side reminder jobs can use the
 * same boundary.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getSpiritualHabits, updatePushToken, updateTimezone } from "@workspace/api-client-react";

const NOTIF_ID_KEY = "stellify-streak-notif-id";
const PERM_REQUESTED_KEY = "stellify-notif-perm-requested";

const NOTIF_CONTENT: Notifications.NotificationContentInput = {
  title: "Streak at risk! 🔥",
  body: "You haven't logged Prayer & Devotion today. Keep your streak alive!",
  data: { screen: "disciple", subTab: "spiritual" },
  sound: true,
};

/** Returns the device's IANA timezone string (e.g. "Asia/Manila"). */
function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Returns the ISO date string (YYYY-MM-DD) for today in the given IANA timezone.
 * Defaults to the device timezone when no argument is provided.
 */
function getTodayDateInTz(tz: string = deviceTimezone()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

/**
 * Returns the 3-letter weekday key for today in the given IANA timezone.
 * e.g. "Mon", "Tue", …, "Sun"
 * Defaults to the device timezone when no argument is provided.
 */
function getTodayDayKey(tz: string = deviceTimezone()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(new Date());
}

/**
 * Returns the ISO date string (YYYY-MM-DD) for the Monday that starts the
 * current week in the given IANA timezone.
 * Defaults to the device timezone when no argument is provided.
 */
function getWeekStart(tz: string = deviceTimezone()): string {
  const now = new Date();

  const dayShort = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(now);
  const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dayShort);
  const offsetToMonday = dayIndex === 0 ? -6 : 1 - dayIndex;

  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
  const [y, m, d] = todayStr.split("-").map(Number) as [number, number, number];
  const monday = new Date(Date.UTC(y, m - 1, d + offsetToMonday));
  return monday.toISOString().split("T")[0] as string;
}

/**
 * Returns a Date object representing 8 PM tomorrow in the device's local
 * timezone (used for the one-shot notification trigger).
 * React Native's `setHours` always operates in device-local time, which is
 * what the Expo notification scheduler also uses for DATE triggers.
 */
function tomorrowAt8PM(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(20, 0, 0, 0);
  return d;
}

function isNotifGranted(
  perms: Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>
): boolean {
  if (Platform.OS === "ios") {
    return (
      perms.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      perms.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  }
  if (Platform.OS === "android") {
    return (perms.android?.importance ?? 0) > 0;
  }
  return false;
}

async function cancelCurrent(): Promise<void> {
  const storedId = await AsyncStorage.getItem(NOTIF_ID_KEY).catch(() => null);
  if (storedId) {
    await Notifications.cancelScheduledNotificationAsync(storedId).catch(() => {});
    await AsyncStorage.removeItem(NOTIF_ID_KEY).catch(() => {});
  }
}

/** Recurring DAILY trigger — fires every night at 8PM device-local time. Used when habits are incomplete. */
async function scheduleDaily(): Promise<void> {
  const id = await Notifications.scheduleNotificationAsync({
    content: NOTIF_CONTENT,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  });
  await AsyncStorage.setItem(NOTIF_ID_KEY, id).catch(() => {});
}

/** One-shot DATE trigger for tomorrow at 8PM device-local time. Used when habits are already done today. */
async function scheduleTomorrow(): Promise<void> {
  const id = await Notifications.scheduleNotificationAsync({
    content: NOTIF_CONTENT,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: tomorrowAt8PM(),
    },
  });
  await AsyncStorage.setItem(NOTIF_ID_KEY, id).catch(() => {});
}

/**
 * Request OS notification permission on first login only (AsyncStorage-gated).
 * Returns true if permission is granted.
 */
export async function requestNotificationPermissionsOnce(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const existing = await Notifications.getPermissionsAsync();
  if (isNotifGranted(existing)) return true;
  const alreadyRequested = await AsyncStorage.getItem(PERM_REQUESTED_KEY).catch(
    () => null
  );
  if (alreadyRequested) return false;
  await AsyncStorage.setItem(PERM_REQUESTED_KEY, "1").catch(() => {});
  const result = await Notifications.requestPermissionsAsync();
  return isNotifGranted(result);
}

/**
 * Persists the device's IANA timezone to the member profile on the server.
 * This allows future server-side reminder jobs and streak-boundary calculations
 * to use the member's local timezone instead of the server's UTC clock.
 * Silently no-ops on web.
 */
export async function syncTimezone(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const tz = deviceTimezone();
    await updateTimezone({ timezone: tz });
  } catch {
    // Non-fatal: the local reminder still fires at the correct device-local time.
  }
}

/**
 * Fast-path called from SpiritualTab as soon as both habits are ticked:
 * cancels tonight's notification and schedules tomorrow's one-shot so
 * compliant members don't receive a false "streak at risk" alert tonight.
 */
export async function rescheduleStreakReminder(): Promise<void> {
  if (Platform.OS === "web") return;
  await cancelCurrent();
  await scheduleTomorrow();
}

/**
 * Obtains the Expo push token for this device and persists it to the server so
 * the nightly server-side streak reminder job can reach this member even when
 * the app hasn't been opened that day.
 *
 * Silently no-ops on web or simulator (where push tokens are unavailable).
 */
export async function registerExpoPushToken(): Promise<void> {
  if (Platform.OS === "web") return;

  const perms = await Notifications.getPermissionsAsync();
  if (!isNotifGranted(perms)) return;

  try {
    const projectId: string | undefined =
      Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    await updatePushToken({ token: tokenData.data });
  } catch {
    // Silently ignore: simulator, missing project ID, or network error.
  }
}

/**
 * State-aware sync. Cancels the current notification, checks today's habit
 * completion via the API, then picks the correct trigger:
 *  - Both done → one-shot for tomorrow (no tonight false positive)
 *  - Either not done → DAILY recurring (fires every night without app open)
 *
 * Uses the device's IANA timezone for all day-boundary comparisons so the
 * "today" window matches what the member sees on their device clock.
 *
 * Called on login, every foreground transition, and right after permission
 * is granted to guarantee first-session scheduling.
 */
export async function syncStreakReminder(): Promise<void> {
  if (Platform.OS === "web") return;
  const perms = await Notifications.getPermissionsAsync();
  if (!isNotifGranted(perms)) return;

  await cancelCurrent();

  const tz = deviceTimezone();

  try {
    const weekStart = getWeekStart(tz);
    const data = await getSpiritualHabits({ weekStart });
    const todayKey = getTodayDayKey(tz);

    const asDays = (d: unknown): Array<{ day?: string; done?: boolean }> =>
      Array.isArray(d) ? (d as Array<{ day?: string; done?: boolean }>) : [];

    const prayerDone = asDays(data.prayer.days).some(
      (d) => d.day === todayKey && d.done
    );
    const devotionDone = asDays(data.devotion.days).some(
      (d) => d.day === todayKey && d.done
    );

    if (prayerDone && devotionDone) {
      await scheduleTomorrow();
    } else {
      await scheduleDaily();
    }
  } catch {
    await scheduleDaily();
  }
}
