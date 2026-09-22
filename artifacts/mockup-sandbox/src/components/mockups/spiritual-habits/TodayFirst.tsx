import { useState } from "react";

const TODAY_HABITS = [
  {
    code: "SHC001",
    label: "Daily Prayer",
    icon: "🙏",
    desc: "Spend time talking and listening to God",
    type: "duration",
    color: "amber",
  },
  {
    code: "SHC002",
    label: "Daily Devotion",
    icon: "📖",
    desc: "Scripture immersion — review, listen, or read",
    type: "select",
    options: ["Review Slide", "Watch Recording", "Audiobook", "Read Bible"],
    color: "blue",
  },
];

const UPCOMING = [
  { code: "SHC003", label: "GOT / Treasury", icon: "💰", due: "Sun", daysLeft: 1, color: "green" },
  { code: "SHC004", label: "Worship Attendance", icon: "⛪", due: "Sun", daysLeft: 1, color: "purple" },
  { code: "SHC005", label: "Biblical Notes", icon: "📝", due: "Sun", daysLeft: 1, color: "rose" },
  { code: "SHC006", label: "CG Attendance", icon: "👥", due: "Sun", daysLeft: 1, color: "cyan" },
];

const COLOR_MAP: Record<string, { ring: string; bg: string; text: string; badge: string }> = {
  amber:  { ring: "ring-amber-400",  bg: "bg-amber-50",   text: "text-amber-700",  badge: "bg-amber-100 text-amber-700" },
  blue:   { ring: "ring-blue-400",   bg: "bg-blue-50",    text: "text-blue-700",   badge: "bg-blue-100 text-blue-700" },
  green:  { ring: "ring-green-400",  bg: "bg-green-50",   text: "text-green-700",  badge: "bg-green-100 text-green-700" },
  purple: { ring: "ring-purple-400", bg: "bg-purple-50",  text: "text-purple-700", badge: "bg-purple-100 text-purple-700" },
  rose:   { ring: "ring-rose-400",   bg: "bg-rose-50",    text: "text-rose-700",   badge: "bg-rose-100 text-rose-700" },
  cyan:   { ring: "ring-cyan-400",   bg: "bg-cyan-50",    text: "text-cyan-700",   badge: "bg-cyan-100 text-cyan-700" },
};

type State = {
  done: boolean;
  expanded: boolean;
  value: string;
};

export function TodayFirst() {
  const [states, setStates] = useState<Record<string, State>>(
    Object.fromEntries(TODAY_HABITS.map((h) => [h.code, { done: false, expanded: false, value: "" }]))
  );

  function toggle(code: string) {
    setStates((s) => {
      const curr = s[code];
      const expanded = !curr.done ? true : false;
      return { ...s, [code]: { ...curr, done: !curr.done, expanded } };
    });
  }

  function expand(code: string) {
    setStates((s) => ({ ...s, [code]: { ...s[code], expanded: !s[code].expanded } }));
  }

  function setValue(code: string, value: string) {
    setStates((s) => ({ ...s, [code]: { ...s[code], value } }));
  }

  const completedCount = Object.values(states).filter((s) => s.done).length;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-0.5">Disciple Hub</p>
          <h1 className="text-xl font-bold text-gray-900">Spiritual Habits</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-400">Week closes</p>
            <p className="text-sm font-semibold text-amber-600">Sun 7:30 AM</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
            {completedCount}/7
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* Today section */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-indigo-600 text-white rounded-2xl px-4 py-2">
              <p className="text-xs opacity-70 uppercase tracking-wider">Today</p>
              <p className="text-xl font-bold leading-tight">Saturday, Jun 28</p>
            </div>
            <div className="text-gray-500 text-sm">
              <p>{completedCount} of 2 daily</p>
              <p>habits done ✓</p>
            </div>
          </div>

          <div className="space-y-3">
            {TODAY_HABITS.map((h) => {
              const st = states[h.code];
              const c = COLOR_MAP[h.color];
              return (
                <div
                  key={h.code}
                  className={`bg-white rounded-2xl border-2 transition-all overflow-hidden ${
                    st.done ? `${c.ring} border-opacity-70` : "border-gray-100"
                  }`}
                >
                  {/* Main row */}
                  <div className="flex items-center gap-4 px-5 py-4">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggle(h.code)}
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        st.done
                          ? "bg-green-500 border-green-500 text-white"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      {st.done && <span className="text-xs font-bold">✓</span>}
                    </button>

                    {/* Icon + label */}
                    <div className="text-2xl">{h.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold ${st.done ? "line-through text-gray-400" : "text-gray-900"}`}>
                        {h.label}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{h.desc}</p>
                    </div>

                    {/* Badge + expand */}
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.badge}`}>{h.code}</span>
                      <button onClick={() => expand(h.code)} className="text-gray-300 hover:text-gray-500 transition-colors text-lg leading-none">
                        {st.expanded ? "▲" : "▼"}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {st.expanded && (
                    <div className={`px-5 pb-4 border-t border-gray-50 ${c.bg}`}>
                      <div className="pt-3">
                        {h.type === "duration" && (
                          <div className="flex items-center gap-3">
                            <label className="text-sm text-gray-600 flex-shrink-0">Duration (min)</label>
                            <input
                              type="number"
                              min={0}
                              placeholder="e.g. 20"
                              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                              value={st.value}
                              onChange={(e) => setValue(h.code, e.target.value)}
                            />
                          </div>
                        )}
                        {h.type === "select" && (
                          <div className="space-y-2">
                            <label className="text-sm text-gray-600">Devotion type</label>
                            <div className="grid grid-cols-2 gap-2">
                              {h.options!.map((opt) => (
                                <button
                                  key={opt}
                                  onClick={() => setValue(h.code, opt)}
                                  className={`text-xs px-3 py-2 rounded-lg border transition-colors text-left ${
                                    st.value === opt
                                      ? "bg-blue-600 text-white border-blue-600"
                                      : "bg-white border-gray-200 text-gray-700 hover:border-blue-300"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming this week */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Coming up this week</h2>
          <div className="space-y-2">
            {UPCOMING.map((h) => {
              const c = COLOR_MAP[h.color];
              return (
                <div key={h.code} className="bg-white rounded-xl border border-gray-100 flex items-center gap-4 px-4 py-3">
                  <div className="text-xl">{h.icon}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">{h.label}</p>
                    <p className="text-xs text-gray-400">Due {h.due} · {h.daysLeft}d left</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.badge}`}>{h.code}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly */}
        <div className="bg-white rounded-2xl border border-gray-100 flex items-center gap-4 px-5 py-4">
          <div className="text-2xl">🤝</div>
          <div className="flex-1">
            <p className="font-semibold text-gray-800">Sharing Huddle</p>
            <p className="text-xs text-gray-400">Monthly · Next due Jul 26</p>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">SHC007</span>
        </div>
      </div>
    </div>
  );
}
