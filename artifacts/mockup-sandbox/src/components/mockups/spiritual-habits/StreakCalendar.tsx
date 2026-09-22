import { useState } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HABITS = [
  { code: "SHC001", label: "Prayer",          color: "bg-amber-500",   light: "bg-amber-100 text-amber-700",   icon: "🙏", type: "daily" },
  { code: "SHC002", label: "Devotion",         color: "bg-blue-500",    light: "bg-blue-100 text-blue-700",     icon: "📖", type: "daily" },
  { code: "SHC003", label: "GOT / Treasury",   color: "bg-green-500",   light: "bg-green-100 text-green-700",   icon: "💰", type: "weekly" },
  { code: "SHC004", label: "Worship",          color: "bg-purple-500",  light: "bg-purple-100 text-purple-700", icon: "⛪", type: "weekly" },
  { code: "SHC005", label: "Biblical Notes",   color: "bg-rose-500",    light: "bg-rose-100 text-rose-700",     icon: "📝", type: "weekly" },
  { code: "SHC006", label: "CG Attendance",    color: "bg-cyan-500",    light: "bg-cyan-100 text-cyan-700",     icon: "👥", type: "weekly" },
  { code: "SHC007", label: "Sharing Huddle",   color: "bg-orange-500",  light: "bg-orange-100 text-orange-700", icon: "🤝", type: "monthly" },
];

type Grid = Record<string, Record<number, boolean>>;

function buildGrid(): Grid {
  return Object.fromEntries(
    HABITS.map((h) => [h.code, Object.fromEntries(DAYS.map((_, i) => [i, Math.random() > 0.4]))])
  );
}

export function StreakCalendar() {
  const [grid, setGrid] = useState<Grid>(buildGrid);
  const [saved, setSaved] = useState<string | null>(null);

  function toggle(code: string, day: number) {
    setGrid((g) => ({ ...g, [code]: { ...g[code], [day]: !g[code][day] } }));
  }

  function streak(code: string) {
    const days = grid[code];
    let count = 0;
    for (let d = 6; d >= 0; d--) {
      if (days[d]) count++;
      else break;
    }
    return count;
  }

  function totalDone() {
    return HABITS.reduce((sum, h) => {
      const done = Object.values(grid[h.code]).filter(Boolean).length;
      return sum + (done > 0 ? 1 : 0);
    }, 0);
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white p-6 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Disciple Hub</p>
            <h1 className="text-2xl font-bold text-white">Spiritual Habits</h1>
            <p className="text-sm text-white/50 mt-0.5">Week of June 22–28, 2026</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-amber-400">{totalDone()}<span className="text-white/30 text-lg">/7</span></div>
            <p className="text-xs text-white/40 mt-0.5">habits active</p>
          </div>
        </div>

        {/* Lock banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 flex items-center gap-3">
          <span className="text-amber-400 text-sm">⏳</span>
          <span className="text-amber-300 text-sm">Submissions close <strong>Sunday, June 28 at 7:30 AM</strong> — 1 day remaining</span>
        </div>

        {/* Matrix grid */}
        <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-[180px_repeat(7,1fr)_56px] gap-0 px-4 py-3 border-b border-white/10">
            <div className="text-xs text-white/30 font-medium">Habit</div>
            {DAYS.map((d) => (
              <div key={d} className="text-center text-xs text-white/40 font-medium">{d}</div>
            ))}
            <div className="text-center text-xs text-white/30 font-medium">Streak</div>
          </div>

          {/* Habit rows */}
          {HABITS.map((h, hi) => (
            <div
              key={h.code}
              className={`grid grid-cols-[180px_repeat(7,1fr)_56px] gap-0 px-4 py-3 ${hi < HABITS.length - 1 ? "border-b border-white/5" : ""} hover:bg-white/3 transition-colors`}
            >
              {/* Habit label */}
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-lg leading-none">{h.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white/90 truncate">{h.label}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${h.light}`}>{h.code}</span>
                </div>
              </div>

              {/* Day cells */}
              {DAYS.map((_, di) => {
                const done = grid[h.code][di];
                const isToday = di === 6;
                return (
                  <div key={di} className="flex items-center justify-center">
                    <button
                      onClick={() => toggle(h.code, di)}
                      className={`w-8 h-8 rounded-lg transition-all ${
                        done
                          ? `${h.color} shadow-lg scale-100`
                          : isToday
                          ? "bg-white/10 border-2 border-white/30 hover:border-white/60"
                          : "bg-white/5 hover:bg-white/10"
                      } ${isToday ? "ring-2 ring-white/20" : ""}`}
                      title={`${h.label} – ${DAYS[di]}`}
                    >
                      {done && <span className="text-white text-xs">✓</span>}
                    </button>
                  </div>
                );
              })}

              {/* Streak */}
              <div className="flex items-center justify-center">
                {streak(h.code) > 0 ? (
                  <div className="flex items-center gap-1">
                    <span className="text-amber-400 text-sm">🔥</span>
                    <span className="text-amber-300 text-xs font-bold">{streak(h.code)}</span>
                  </div>
                ) : (
                  <span className="text-white/20 text-xs">—</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Summary footer */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Days completed", value: Object.values(grid).reduce((s, d) => s + Object.values(d).filter(Boolean).length, 0), unit: "logs" },
            { label: "Best streak", value: Math.max(...HABITS.map((h) => streak(h.code))), unit: "days" },
            { label: "Fragments earned", value: Object.values(grid).reduce((s, d) => s + Object.values(d).filter(Boolean).length, 0) * 10, unit: "pts" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
              <div className="text-2xl font-bold text-amber-400">{stat.value}</div>
              <div className="text-xs text-white/40 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Save */}
        <button
          onClick={() => setSaved("Week saved!")}
          className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-3 rounded-xl transition-colors"
        >
          {saved ?? "Save Week"}
        </button>
      </div>
    </div>
  );
}
