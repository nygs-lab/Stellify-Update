import { Ionicons } from "@expo/vector-icons";
import { useGetStellarbBoard } from "@workspace/api-client-react";
import type { StellarbBoardEntry } from "@workspace/api-client-react";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const STELLAR_SHORT: Record<string, string> = {
  SBG: "SBG",
  P2S: "P2S",
  S2B: "S2B",
  P2G: "P2G",
};

function getMedalColor(rank: number, colors: ReturnType<typeof import("@/hooks/useColors").useColors>) {
  if (rank === 1) return colors.gold;
  if (rank === 2) return colors.silver;
  if (rank === 3) return colors.bronze;
  return colors.mutedForeground;
}

function getMedalIcon(rank: number): keyof typeof Ionicons.glyphMap {
  if (rank === 1) return "trophy";
  if (rank === 2) return "medal";
  if (rank === 3) return "ribbon";
  return "star-outline";
}

function RankingCard({ entry }: { entry: StellarbBoardEntry }) {
  const colors = useColors();
  const rank = entry.rank;
  const medalColor = getMedalColor(rank, colors);
  const isTop = rank <= 3;
  const fragments = entry.stellarFragments;
  const stellarStatus = entry.stellarStatus;
  const bestStreak = entry.bestStreak;

  return (
    <View style={[podStyles.card, {
      backgroundColor: isTop ? medalColor + "15" : colors.card,
      borderColor: isTop ? medalColor + "50" : colors.border,
    }]}>
      <View style={[podStyles.rankCircle, { backgroundColor: isTop ? medalColor : colors.secondary }]}>
        {isTop ? (
          <Ionicons name={getMedalIcon(rank)} size={18} color={rank === 1 ? "#1A1200" : "#FFFFFF"} />
        ) : (
          <Text style={[podStyles.rankNum, { color: colors.mutedForeground }]}>{rank}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[podStyles.churchId, { color: colors.foreground }]}>
          {entry.churchId ?? "—"}
        </Text>
        <Text style={[podStyles.meta, { color: colors.mutedForeground }]}>
          {STELLAR_SHORT[stellarStatus] ?? stellarStatus}
          {bestStreak > 0 ? ` · ${bestStreak}wk streak` : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[podStyles.fragments, { color: isTop ? medalColor : colors.primary }]}>
          {fragments.toLocaleString()}
        </Text>
        <Text style={[podStyles.fragLabel, { color: colors.mutedForeground }]}>frags</Text>
      </View>
    </View>
  );
}

const podStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  rankCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  rankNum: { fontSize: 15, fontFamily: "Inter_700Bold" },
  churchId: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  meta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  fragments: { fontSize: 18, fontFamily: "Inter_700Bold" },
  fragLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
});

export default function StellarBoardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const currentYear = new Date().getFullYear();

  const { data, isLoading, isFetching, refetch } = useGetStellarbBoard();

  const rankings = data?.rankings ?? [];
  const year = data?.year ?? currentYear;

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[s.header, { paddingTop: topPad + 16, backgroundColor: colors.navBackground }]}>
        <Text style={s.headerTitle}>StellarBoard</Text>
        <Text style={s.headerSub}>
          {year} · Annual Fragment Rankings
        </Text>
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : rankings.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="trophy-outline" size={48} color={colors.mutedForeground} />
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>No Rankings Yet</Text>
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
            Start logging habits to appear on the StellarBoard.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rankings}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => <RankingCard entry={item} />}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 100,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            rankings.length > 0 ? (
              <View style={[s.legend, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", gap: 16 }}>
                  {[
                    { color: colors.gold, label: "1st" },
                    { color: colors.silver, label: "2nd" },
                    { color: colors.bronze, label: "3rd" },
                  ].map((m) => (
                    <View key={m.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: m.color }} />
                      <Text style={[s.legendText, { color: colors.mutedForeground }]}>{m.label}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[s.legendTotal, { color: colors.mutedForeground }]}>
                  {rankings.length} ranked
                </Text>
              </View>
            ) : null
          }
          scrollEnabled={rankings.length > 0}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  legend: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  legendText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  legendTotal: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
