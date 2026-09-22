import { useState } from "react";

const SECTIONS = [
  {
    code: "SHC001",
    label: "Daily Prayer",
    icon: "🙏",
    color: "amber",
    tab: "Daily",
    fields: [
      { id: "days", type: "days", label: "Days prayed this week" },
      { id: "avgDuration", type: "number", label: "Average duration (minutes)" },
    ],
  },
  {
    code: "SHC002",
    label: "Daily Devotion",
    icon: "📖",
    color: "blue",
    tab: "Daily",
    fields: [
      { id: "days", type: "days", label: "Days completed" },
      { id: "type", type: "select", label: "Primary devotion type", options: ["Review Slide", "Watch Recording", "Audiobook", "Read Bible"] },
    ],
  },
  {
    code: "SHC003",
    label: "GOT / Treasury",
    icon: "💰",
    color: "green",
    tab: "Weekly",
    fields: [
      { id: "amount", type: "number", label: "Total submitted (RM)" },
      { id: "method", type: "select", label: "Method", options: ["eWallet", "Bank Transfer", "Cash"] },
    ],
  },
  {
    code: "SHC004",
    label: "Worship Attendance",
    icon: "⛪",
    color: "purple",
    tab: "Weekly",
    fields: [
      { id: "attendance", type: "select", label: "Attendance", options: ["Online", "Onsite", "Absent"] },
    ],
  },
  {
    code: "SHC005",
    label: "Biblical Notes",
    icon: "📝",
    color: "rose",
    tab: "Weekly",
    fields: [
      { id: "format", type: "select", label: "Format", options: ["Digital (BSF/BUP)", "Handwritten"] },
      { id: "topic", type: "text", label: "Sermon topic / reference" },
    ],
  },
  {
    code: "SHC006",
    label: "CG Attendance",
    icon: "👥",
    color: "cyan",
    tab: "Weekly",
    fields: [
      { id: "attended", type: "select", label: "Attendance", options: ["Attended", "Absent"] },
      { id: "answer", type: "textarea", label: "Weekly question answer" },
    ],
  },
  {
    code: "SHC007",
    label: "Sharing Huddle",
    icon: "🤝",
    color: "orange",
    tab: "Monthly",
    fields: [
      { id: "attended", type: "select", label: "Attendance", options: ["Attended", "Absent"] },
      { id: "answer", type: "textarea", label: "Monthly question answer" },
    ],
  },
];

const COLOR = {
  amber:  { dot: "bg-amber-500",  badge: "bg-amber-100 text-amber-700",  bar: "bg-amber-500",  btn: "bg-amber-500 hover:bg-amber-400" },
  blue:   { dot: "bg-blue-500",   badge: "bg-blue-100 text-blue-700",    bar: "bg-blue-500",   btn: "bg-blue-600 hover:bg-blue-500" },
  green:  { dot: "bg-green-500",  badge: "bg-green-100 text-green-700",  bar: "bg-green-500",  btn: "bg-green-600 hover:bg-green-500" },
  purple: { dot: "bg-purple-500", badge: "bg-purple-100 text-purple-700",bar: "bg-purple-500", btn: "bg-purple-600 hover:bg-purple-500" },
  rose:   { dot: "bg-rose-500",   badge: "bg-rose-100 text-rose-700",    bar: "bg-rose-500",   btn: "bg-rose-600 hover:bg-rose-500" },
  cyan:   { dot: "bg-cyan-500",   badge: "bg-cyan-100 text-cyan-700",    bar: "bg-cyan-500",   btn: "bg-cyan-600 hover:bg-cyan-500" },
  orange: { dot: "bg-orange-500", badge: "bg-orange-100 text-orange-700",bar: "bg-orange-500", btn: "bg-orange-500 hover:bg-orange-400" },
} as Record<string, { dot: string; badge: string; bar: string; btn: string }>;

type Values = Record<string, Record<string, string | number[]>>;

export function WeeklyReport() {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Values>({});
  const [submitted, setSubmitted] = useState(false);

  function toggle(code: string) {
    setOpen((o) => ({ ...o, [code]: !o[code] }));
  }

  function setValue(code: string, field: string, val: string | number[]) {
    setValues((v) => ({ ...v, [code]: { ...v[code], [field]: val } }));
  }

  function hasValue(code: string) {
    return Object.keys(values[code] ?? {}).length > 0;
  }

  const completed = SECTIONS.filter((s) => hasValue(s.code)).length;
  const pct = Math.round((completed / SECTIONS.length) * 100);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-widest">Disciple Hub</p>
              <h1 className="text-xl font-bold text-slate-900">Weekly Spiritual Report</h1>
              <p className="text-xs text-slate-400 mt-0.5">Week of June 22–28, 2026</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-indigo-600">{pct}%</div>
              <p className="text-xs text-slate-400">{completed}/7 complete</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-amber-600 font-medium whitespace-nowrap">⏳ 1 day left</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6 space-y-3">
        {SECTIONS.map((s) => {
          const c = COLOR[s.color];
          const done = hasValue(s.code);
          const isOpen = !!open[s.code];

          return (
            <div
              key={s.code}
              className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                done ? "border-indigo-200" : "border-slate-200"
              }`}
            >
              {/* Header row */}
              <button
                onClick={() => toggle(s.code)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left"
              >
                <div className={`w-1 h-10 rounded-full flex-shrink-0 ${c.dot}`} />
                <div className="text-2xl">{s.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-slate-800">{s.label}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.badge}`}>{s.code}</span>
                    <span className="text-[10px] text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded-full">{s.tab}</span>
                  </div>
                  {done ? (
                    <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                      <span>✓</span>
                      <span>Logged</span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Tap to fill in details</p>
                  )}
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                  done ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"
                }`}>
                  {done ? "✓" : (isOpen ? "▲" : "▼")}
                </div>
              </button>

              {/* Form body */}
              {isOpen && (
                <div className="px-5 pb-5 border-t border-slate-50 space-y-4 pt-4">
                  {s.fields.map((f) => (
                    <div key={f.id}>
                      <label className="block text-sm font-medium text-slate-600 mb-1.5">{f.label}</label>
                      {f.type === "days" && (
                        <div className="flex gap-2">
                          {["S","M","T","W","T","F","S"].map((day, i) => {
                            const dayArr: number[] = (values[s.code]?.[f.id] as number[]) ?? [];
                            const checked = dayArr.includes(i);
                            return (
                              <button
                                key={i}
                                onClick={() => {
                                  const arr = dayArr.includes(i) ? dayArr.filter(d => d !== i) : [...dayArr, i];
                                  setValue(s.code, f.id, arr);
                                }}
                                className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${
                                  checked
                                    ? `${c.dot} text-white`
                                    : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {f.type === "number" && (
                        <input
                          type="number"
                          min={0}
                          placeholder="Enter value"
                          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          value={(values[s.code]?.[f.id] as string) ?? ""}
                          onChange={(e) => setValue(s.code, f.id, e.target.value)}
                        />
                      )}
                      {f.type === "text" && (
                        <input
                          type="text"
                          placeholder="Enter text"
                          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          value={(values[s.code]?.[f.id] as string) ?? ""}
                          onChange={(e) => setValue(s.code, f.id, e.target.value)}
                        />
                      )}
                      {f.type === "select" && (
                        <div className="grid grid-cols-2 gap-2">
                          {f.options!.map((opt) => (
                            <button
                              key={opt}
                              onClick={() => setValue(s.code, f.id, opt)}
                              className={`text-sm px-3 py-2.5 rounded-xl border transition-all text-left ${
                                values[s.code]?.[f.id] === opt
                                  ? "bg-indigo-600 text-white border-indigo-600"
                                  : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                      {f.type === "textarea" && (
                        <textarea
                          rows={3}
                          placeholder="Write your answer…"
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                          value={(values[s.code]?.[f.id] as string) ?? ""}
                          onChange={(e) => setValue(s.code, f.id, e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      if (!values[s.code]) setValue(s.code, "confirmed", "true");
                      toggle(s.code);
                    }}
                    className={`w-full text-white py-2.5 rounded-xl text-sm font-semibold transition-colors ${c.btn}`}
                  >
                    Save {s.label}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Submit */}
        {!submitted ? (
          <button
            onClick={() => setSubmitted(true)}
            disabled={completed === 0}
            className={`w-full py-4 rounded-2xl font-bold text-lg transition-all mt-2 ${
              completed === SECTIONS.length
                ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-200"
                : completed > 0
                ? "bg-indigo-400 text-white cursor-pointer"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            Submit Weekly Report ({completed}/{SECTIONS.length})
          </button>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-2">✅</div>
            <p className="font-bold text-green-800 text-lg">Report submitted!</p>
            <p className="text-green-600 text-sm mt-1">Your spiritual week has been recorded.</p>
          </div>
        )}
      </div>
    </div>
  );
}
