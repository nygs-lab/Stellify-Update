import { useState } from "react";

const STATIONS = [
  { code: "SHC001", label: "Daily Prayer",       icon: "🙏", xp: 70, desc: "7 days of prayer logged",          type: "daily",   maxDays: 7 },
  { code: "SHC002", label: "Daily Devotion",      icon: "📖", xp: 70, desc: "7 days of devotion logged",       type: "daily",   maxDays: 7 },
  { code: "SHC003", label: "Treasury",            icon: "💰", xp: 50, desc: "GOT offering submitted",           type: "weekly",  maxDays: 1 },
  { code: "SHC004", label: "Worship",             icon: "⛪", xp: 50, desc: "Attendance recorded",              type: "weekly",  maxDays: 1 },
  { code: "SHC005", label: "Biblical Notes",      icon: "📝", xp: 50, desc: "Weekly notes submitted",          type: "weekly",  maxDays: 1 },
  { code: "SHC006", label: "CG Attendance",       icon: "👥", xp: 50, desc: "Cell group attendance recorded",  type: "weekly",  maxDays: 1 },
  { code: "SHC007", label: "Sharing Huddle",      icon: "🤝", xp: 30, desc: "Monthly huddle attended",         type: "monthly", maxDays: 1 },
];

type Progress = { completed: number; total: number };

function buildProgress(): Record<string, Progress> {
  return Object.fromEntries(
    STATIONS.map((s) => {
      const done = Math.floor(Math.random() * (s.maxDays + 1));
      return [s.code, { completed: done, total: s.maxDays }];
    })
  );
}

export function JourneyPath() {
  const [progress, setProgress] = useState<Record<string, Progress>>(buildProgress);
  const [active, setActive] = useState<string | null>(null);

  function advance(code: string) {
    setProgress((p) => {
      const curr = p[code];
      if (curr.completed < curr.total) {
        return { ...p, [code]: { ...curr, completed: curr.completed + 1 } };
      }
      return p;
    });
  }

  function isDone(code: string) {
    const p = progress[code];
    return p.completed >= p.total;
  }

  const totalXP = STATIONS.reduce((sum, s) => {
    const p = progress[s.code];
    return sum + Math.floor((p.completed / p.total) * s.xp);
  }, 0);
  const maxXP = STATIONS.reduce((s, h) => s + h.xp, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0a3e] via-[#2d1060] to-[#1a0a3e] font-sans text-white px-4 py-8">
      <div className="max-w-md mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-xs text-purple-300/60 uppercase tracking-widest mb-2">Week of June 22–28</p>
          <h1 className="text-3xl font-bold text-white mb-1">Spiritual Journey</h1>
          <p className="text-purple-200/60 text-sm">Complete each station to earn fragments</p>

          {/* XP bar */}
          <div className="mt-5 bg-white/10 rounded-full h-3 mx-8 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 rounded-full transition-all duration-700"
              style={{ width: `${(totalXP / maxXP) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-purple-200/50 mx-8 mt-1">
            <span>0 XP</span>
            <span className="text-amber-300 font-bold">{totalXP} / {maxXP} XP</span>
            <span>{maxXP} XP</span>
          </div>
        </div>

        {/* Journey path */}
        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute left-9 top-10 bottom-10 w-0.5 bg-white/10" />

          <div className="space-y-3">
            {STATIONS.map((station, i) => {
              const p = progress[station.code];
              const done = isDone(station.code);
              const partial = p.completed > 0 && !done;
              const isActive = active === station.code;
              const pct = (p.completed / p.total) * 100;

              return (
                <div key={station.code}>
                  {/* Station node */}
                  <button
                    onClick={() => setActive(isActive ? null : station.code)}
                    className={`w-full flex items-center gap-4 relative z-10 transition-all`}
                  >
                    {/* Circle */}
                    <div className={`w-[72px] h-[72px] rounded-2xl flex-shrink-0 flex flex-col items-center justify-center border-2 transition-all ${
                      done
                        ? "bg-gradient-to-br from-amber-400 to-yellow-500 border-amber-300 shadow-lg shadow-amber-500/30"
                        : partial
                        ? "bg-purple-800/50 border-purple-500/60"
                        : "bg-white/5 border-white/10"
                    }`}>
                      <span className="text-2xl leading-none">{station.icon}</span>
                      {done ? (
                        <span className="text-[10px] text-black font-bold mt-0.5">DONE</span>
                      ) : (
                        <span className="text-[10px] text-purple-300/60 mt-0.5">{station.code}</span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 text-left">
                      <div className="flex items-center justify-between mb-1">
                        <p className={`font-semibold ${done ? "text-amber-300" : "text-white/80"}`}>{station.label}</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-purple-300/60">+{station.xp} XP</span>
                          <span className="text-white/20">·</span>
                          <span className="text-xs text-purple-200/40 capitalize">{station.type}</span>
                        </div>
                      </div>
                      {/* Progress bar */}
                      {station.maxDays > 1 ? (
                        <div>
                          <div className="bg-white/10 rounded-full h-1.5 mb-1">
                            <div
                              className={`h-full rounded-full transition-all ${done ? "bg-amber-400" : "bg-purple-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-xs text-purple-200/40">{p.completed}/{p.total} days</p>
                        </div>
                      ) : (
                        <p className="text-xs text-purple-200/40">{station.desc}</p>
                      )}
                    </div>
                  </button>

                  {/* Expanded action panel */}
                  {isActive && (
                    <div className="ml-[88px] mt-2 mb-2 bg-white/5 border border-white/10 rounded-xl p-4">
                      <p className="text-sm text-purple-200/70 mb-3">{station.desc}</p>
                      {done ? (
                        <div className="flex items-center gap-2 text-amber-300 text-sm font-medium">
                          <span>✨</span>
                          <span>Station complete! +{station.xp} XP earned</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => advance(station.code)}
                          className="w-full bg-purple-600 hover:bg-purple-500 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
                        >
                          {station.maxDays > 1 ? `Log ${station.label} for today` : `Log ${station.label}`}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Connector dot */}
                  {i < STATIONS.length - 1 && (
                    <div className="flex justify-center ml-[36px] my-0.5">
                      <div className={`w-1 h-4 rounded-full ${isDone(station.code) ? "bg-amber-400/40" : "bg-white/5"}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-purple-300/50 uppercase tracking-wider">This week</p>
            <p className="text-lg font-bold text-amber-300">{totalXP} XP earned</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-purple-300/50 uppercase tracking-wider">Closes</p>
            <p className="text-sm text-amber-400 font-medium">Sun 7:30 AM</p>
          </div>
        </div>
      </div>
    </div>
  );
}
