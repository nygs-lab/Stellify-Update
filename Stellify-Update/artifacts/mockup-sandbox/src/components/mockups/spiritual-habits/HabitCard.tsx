import { useState, CSSProperties } from "react";

// ─── Design tokens ────────────────────────────────────────────────────────
const T = {
  pageBg:      "#C8956A",
  cardBg:      "#D4A87A",
  headerBg:    "#E8D0A0",
  descBg:      "#F2E8D0",
  gridBg:      "#6B4020",
  rowBg:       "#8B5830",
  rowAltBg:    "#7A4C28",
  cellBgLight: "#C8A060",
  summaryBg:   "#5A3418",
  summaryCell: "#7A4C28",
  border:      "#A07040",
  borderLight: "#C8A878",
  textDark:    "#2A1408",
  textMid:     "#5A3820",
  textLight:   "#F5E8D0",
  textMuted:   "#C8A878",
  onBadge:     "#C8A060",
  lockBadge:   "#8B6040",
  detailBg:    "#E4C890",
  detailRow:   "#D4B878",
};

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DEVOTION_TYPES = [
  "Review the Slide",
  "Watch Message Recording",
  "Listen to Audiobook",
  "Read Bible",
];

type HabitDef = {
  habit: string;
  aspect: string;
  code: string;
  frequency: string;
  description: string;
  l2Desc: string;
  l3aTarget: number;
  l3aLabel: string;
  defaultDurations: number[];
  hasDetailLog?: boolean;
};

const PRAYER: HabitDef = {
  habit: "Prayer",
  aspect: "Spiritual",
  code: "SHC001",
  frequency: "This habit is done daily, ideally at the start of the day.",
  description:
    "Prayer is a spiritual habit where members connect their hearts to God, by praising His character, confessing shortcomings, thanking Him for blessings, and bringing needs before Him.",
  l2Desc: "Time: 05:00AM – 05:20AM\nTime: 09:40PM – 10:00AM",
  l3aTarget: 20,
  l3aLabel: "Committed time for Prayer (Minutes)",
  defaultDurations: [20, 22, 21, 23, 20, 25, 21],
  hasDetailLog: false,
};

const DEVOTION: HabitDef = {
  habit: "Devotion",
  aspect: "Spiritual",
  code: "SHC002",
  frequency: "This habit is done daily, ideally at the start of the day.",
  description:
    "Devotion is a spiritual habit where members immerse themselves in the Word of God by reading the Bible, reviewing message slides, and listening to message recordings or audiobooks",
  l2Desc: "Time 5:30AM – 6:00 AM",
  l3aTarget: 30,
  l3aLabel: "Committed time for Devotion (Minutes)",
  defaultDurations: [30, 30, 30, 30, 30, 30, 30],
  hasDetailLog: true,
};

// ─── State ────────────────────────────────────────────────────────────────
type DetailRow = { type: string; details: string };

type CardState = {
  l1: boolean[];
  l2: boolean[];
  l3a: boolean[];
  l3b: number[];
  l3aActive: boolean;
  l3bActive: boolean;
  detailLog: DetailRow[];
};

const DEFAULT_DETAILS: DetailRow[] = [
  { type: "Review the Slide",         details: "BM_SOAP_June_14_2026_Juan_04_48.pptx" },
  { type: "Watch Message Recording",  details: "Biblical Message June 7 2026" },
  { type: "Watch Message Recording",  details: "Biblical Message June 7 2026" },
  { type: "Watch Message Recording",  details: "Biblical Message June 7 2026" },
  { type: "Listen to Audiobook",      details: "The Answer Book - Lesson 1" },
  { type: "Listen to Audiobook",      details: "The Answer Book - Lesson 2" },
  { type: "Read Bible",               details: "Matthew 1:1-12" },
];

function makeState(def: HabitDef): CardState {
  return {
    l1: Array(7).fill(true),
    l2: Array(7).fill(true),
    l3a: Array(7).fill(true),
    l3b: [...def.defaultDurations],
    l3aActive: true,
    l3bActive: true,
    detailLog: Array.from({ length: 7 }, (_, i) =>
      DEFAULT_DETAILS[i]
        ? { ...DEFAULT_DETAILS[i] }
        : { type: DEVOTION_TYPES[0], details: "" }
    ),
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────
function CheckCell({
  checked,
  onClick,
  disabled,
}: {
  checked: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 36, height: 36, borderRadius: 6,
        border: `2px solid ${T.borderLight}`,
        backgroundColor: checked ? T.headerBg : T.rowBg,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "default" : "pointer", flexShrink: 0,
      }}
    >
      {checked && (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <polyline points="3,9 7,13 15,5" stroke={T.textDark} strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 44, height: 24, borderRadius: 12,
        border: `2px solid ${T.borderLight}`,
        backgroundColor: on ? "#A07040" : T.rowBg,
        position: "relative", cursor: "pointer", flexShrink: 0,
        transition: "background-color 0.2s",
      }}
    >
      <div style={{
        position: "absolute", top: 2, left: on ? 18 : 2,
        width: 16, height: 16, borderRadius: "50%",
        backgroundColor: on ? T.headerBg : T.textMuted,
        transition: "left 0.2s",
      }} />
    </button>
  );
}

// ─── Main card block ──────────────────────────────────────────────────────
function HabitCardBlock({ def }: { def: HabitDef }) {
  const [st, setSt] = useState<CardState>(() => makeState(def));
  const [editing, setEditing] = useState(false);

  const toggle = (field: "l1" | "l2" | "l3a", d: number) =>
    setSt((s) => { const a = [...s[field]]; a[d] = !a[d]; return { ...s, [field]: a }; });

  const setDur = (d: number, v: string) =>
    setSt((s) => { const l3b = [...s.l3b]; l3b[d] = parseInt(v) || 0; return { ...s, l3b }; });

  const setDetailType = (d: number, v: string) =>
    setSt((s) => {
      const detailLog = [...s.detailLog];
      detailLog[d] = { ...detailLog[d], type: v };
      return { ...s, detailLog };
    });

  const setDetailText = (d: number, v: string) =>
    setSt((s) => {
      const detailLog = [...s.detailLog];
      detailLog[d] = { ...detailLog[d], details: v };
      return { ...s, detailLog };
    });

  const daysCompleted = st.l1.filter(Boolean).length;
  const daysCompliant = st.l2.filter(Boolean).length;
  const daysCommitted = st.l3a.filter(Boolean).length;
  const sumDur = st.l3b.reduce((a, b) => a + b, 0);
  const target = def.l3aTarget * 7;
  const pct = target > 0 ? ((sumDur / target) * 100).toFixed(2) : "0.00";

  const cell: CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center", minWidth: 52,
  };

  const cols = "52px 140px 170px repeat(7, 52px) 130px";

  const rowStyle = (alt: boolean): CSSProperties => ({
    display: "grid",
    gridTemplateColumns: cols,
    gap: 2,
    alignItems: "center",
    backgroundColor: alt ? T.rowAltBg : T.rowBg,
    borderRadius: 8,
    padding: "10px 0",
  });

  const summaryCellStyle: CSSProperties = {
    display: "flex", flexDirection: "column", gap: 4, alignItems: "center",
    backgroundColor: T.summaryBg, borderRadius: 6, padding: "6px 4px", margin: "0 4px",
  };

  const statBox: CSSProperties = {
    backgroundColor: T.summaryCell, borderRadius: 4, padding: "3px 8px",
    fontSize: 12, fontWeight: "bold", color: T.textLight, textAlign: "center", width: "100%",
  };

  return (
    <div style={{
      backgroundColor: T.cardBg, borderRadius: 16, overflow: "hidden",
      border: `2px solid ${T.border}`, fontFamily: "'Georgia', serif",
    }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: T.headerBg, padding: "16px 20px" }}>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{
              width: 52, height: 52, flexShrink: 0, backgroundColor: "#C8A020",
              clipPath: "polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)",
            }} />
            <div style={{ fontWeight: "bold", fontSize: 14, color: T.textDark, lineHeight: 1.4 }}>
              Stellify<br />Habit<br />Card
            </div>
          </div>

          {/* Info table */}
          <div style={{ flex: 1, border: `1.5px solid ${T.border}`, borderRadius: 6, overflow: "hidden", fontSize: 13 }}>
            {[["Habit", def.habit], ["Aspect", def.aspect], ["Code", def.code]].map(([k, v], i, arr) => (
              <div key={k} style={{ display: "flex", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
                <div style={{ width: 70, padding: "5px 10px", backgroundColor: T.cardBg, borderRight: `1px solid ${T.border}`, color: T.textMid, fontWeight: "bold", fontSize: 12 }}>{k}</div>
                <div style={{ padding: "5px 10px", color: T.textDark, flex: 1 }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Frequency */}
          <div style={{ fontSize: 12, color: T.textMid, maxWidth: 160, lineHeight: 1.5 }}>
            <strong>Habit Frequency:</strong><br />{def.frequency}
          </div>

          {/* Controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {["EDIT", "SAVE"].map((label) => (
                <button key={label} onClick={() => label === "EDIT" && setEditing((e) => !e)} style={{
                  padding: "5px 16px", border: `2px solid ${T.border}`, borderRadius: 5,
                  backgroundColor: (label === "EDIT" && editing) ? T.cardBg : T.headerBg,
                  color: T.textDark, fontWeight: "bold", fontSize: 12, cursor: "pointer", letterSpacing: "0.05em",
                }}>{label}</button>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.textMid, marginBottom: 4, fontWeight: "bold" }}>Date Range Selector</div>
              <select style={{
                width: "100%", padding: "5px 10px", border: `2px solid ${T.border}`, borderRadius: 6,
                backgroundColor: T.headerBg, color: T.textDark, fontSize: 13, fontWeight: "bold", cursor: "pointer",
              }}>
                <option>Jun 28 – Jul 04</option>
                <option>Jun 21 – Jun 27</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { label: "✓ On-Going", bg: T.onBadge, color: T.textDark },
                { label: "🔒 Locked", bg: T.lockBadge, color: T.textLight },
              ].map(({ label, bg, color }) => (
                <div key={label} style={{
                  padding: "4px 10px", borderRadius: 20, backgroundColor: bg,
                  border: `1.5px solid ${T.border}`, fontSize: 11, fontWeight: "bold", color,
                }}>{label}</div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: T.textMid, maxWidth: 220, lineHeight: 1.4 }}>
              <em>Note: Once a Habit Card is selected it becomes active, which means that members must track completeness and compliance. A Habit card is locked for a month. To unlock contact Church I.T.</em>
            </div>
          </div>
        </div>
      </div>

      {/* ── Description ──────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: T.descBg, padding: "10px 20px", borderTop: `1.5px solid ${T.border}`, borderBottom: `1.5px solid ${T.border}` }}>
        <div style={{
          display: "inline-block", border: `1.5px solid ${T.border}`, borderRadius: 4,
          padding: "2px 8px", fontSize: 12, fontWeight: "bold", color: T.textMid,
          marginBottom: 6, backgroundColor: T.headerBg,
        }}>Habit Description:</div>
        <p style={{ fontSize: 13, color: T.textDark, lineHeight: 1.6, margin: 0 }}>{def.description}</p>
      </div>

      {/* ── Level Grid ───────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: T.gridBg, padding: "0" }}>
        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: cols, gap: 2, padding: "8px 12px 4px", alignItems: "center" }}>
          <div style={{ fontSize: 11, fontWeight: "bold", color: T.textMuted, textAlign: "center" }}>ON/OFF</div>
          <div style={{ fontSize: 11, fontWeight: "bold", color: T.textMuted }}>Level</div>
          <div style={{ fontSize: 11, fontWeight: "bold", color: T.textMuted }}>Description</div>
          {DAYS.map((d) => (
            <div key={d} style={{ fontSize: 11, fontWeight: "bold", color: T.textMuted, textAlign: "center" }}>{d}</div>
          ))}
          <div style={{ fontSize: 11, fontWeight: "bold", color: T.textMuted, textAlign: "center" }}>SUMMARY</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 12px 12px" }}>
          {/* L1 */}
          <div style={rowStyle(false)}>
            <div style={cell}><Toggle on={true} onToggle={() => {}} /></div>
            <div style={{ fontSize: 12, fontWeight: "bold", color: T.textLight, paddingLeft: 4 }}>Level 1 – Task Completion</div>
            <div style={{ fontSize: 11, color: T.textMuted, paddingLeft: 4 }}>
              <span style={{ fontSize: 10, opacity: 0.7 }}>Describe: </span>Complete Daily {def.habit}
            </div>
            {st.l1.map((c, d) => (
              <div key={d} style={cell}><CheckCell checked={c} onClick={() => toggle("l1", d)} disabled={!editing} /></div>
            ))}
            <div style={summaryCellStyle}>
              <div style={statBox}>{daysCompleted} of 7</div>
              <div style={{ fontSize: 10, color: T.textMuted, textAlign: "center" }}>Days Completed</div>
            </div>
          </div>

          {/* L2 */}
          <div style={rowStyle(true)}>
            <div style={cell}><Toggle on={true} onToggle={() => {}} /></div>
            <div style={{ fontSize: 12, fontWeight: "bold", color: T.textLight, paddingLeft: 4 }}>Level 2 – Task Compliance</div>
            <div style={{ fontSize: 11, color: T.textMuted, paddingLeft: 4, lineHeight: 1.5 }}>
              <span style={{ fontSize: 10, opacity: 0.7 }}>Describe: </span>
              {def.l2Desc.split("\n").map((line, i) => <span key={i}>{line}<br /></span>)}
            </div>
            {st.l2.map((c, d) => (
              <div key={d} style={cell}><CheckCell checked={c} onClick={() => toggle("l2", d)} disabled={!editing} /></div>
            ))}
            <div style={summaryCellStyle}>
              <div style={statBox}>{daysCompliant} of 7</div>
              <div style={{ fontSize: 10, color: T.textMuted, textAlign: "center" }}>Days Compliant</div>
            </div>
          </div>

          {/* L3A */}
          <div style={rowStyle(false)}>
            <div style={cell}><Toggle on={st.l3aActive} onToggle={() => setSt((s) => ({ ...s, l3aActive: !s.l3aActive }))} /></div>
            <div style={{ fontSize: 12, fontWeight: "bold", color: T.textLight, paddingLeft: 4 }}>Level 3A – Time Committed</div>
            <div style={{ fontSize: 11, color: T.textMuted, paddingLeft: 4, lineHeight: 1.5 }}>
              <span style={{ fontSize: 10, opacity: 0.7 }}>Describe: </span>
              {def.l3aLabel}<br />
              <input type="number" defaultValue={def.l3aTarget} style={{
                width: 44, padding: "2px 4px", borderRadius: 4, border: `1px solid ${T.borderLight}`,
                backgroundColor: T.cellBgLight, color: T.textDark, fontSize: 12, fontWeight: "bold", textAlign: "center",
              }} />
            </div>
            {st.l3a.map((c, d) => (
              <div key={d} style={cell}><CheckCell checked={c} onClick={() => toggle("l3a", d)} disabled={!st.l3aActive || !editing} /></div>
            ))}
            <div style={summaryCellStyle}>
              <div style={statBox}>{daysCommitted} of 7</div>
              <div style={{ fontSize: 10, color: T.textMuted, textAlign: "center" }}>Days Committed</div>
            </div>
          </div>

          {/* L3B */}
          <div style={rowStyle(true)}>
            <div style={cell}><Toggle on={st.l3bActive} onToggle={() => setSt((s) => ({ ...s, l3bActive: !s.l3bActive }))} /></div>
            <div style={{ fontSize: 12, fontWeight: "bold", color: T.textLight, paddingLeft: 4 }}>Level 3B – Duration Log</div>
            <div style={{ fontSize: 11, color: T.textMuted, paddingLeft: 4, lineHeight: 1.5 }}>
              <span style={{ fontSize: 10, opacity: 0.7 }}>Describe: </span>Log the time spent in minutes
            </div>
            {st.l3b.map((v, d) => (
              <div key={d} style={cell}>
                <input type="number" value={v} disabled={!st.l3bActive || !editing} onChange={(e) => setDur(d, e.target.value)} style={{
                  width: 44, height: 36, padding: "4px 2px", borderRadius: 6,
                  border: `2px solid ${T.borderLight}`,
                  backgroundColor: st.l3bActive ? T.cellBgLight : T.rowBg,
                  color: T.textDark, fontSize: 13, fontWeight: "bold", textAlign: "center",
                  opacity: st.l3bActive ? 1 : 0.5,
                }} />
              </div>
            ))}
            <div style={summaryCellStyle}>
              <div style={{ ...statBox, display: "flex", justifyContent: "space-between", gap: 4 }}>
                <span>{sumDur}/{target}</span>
                <span style={{ color: "#F0D080" }}>{pct}%</span>
              </div>
              <div style={{ fontSize: 10, color: T.textMuted, textAlign: "center", lineHeight: 1.3 }}>
                Sum Duration<br />Percentage
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Devotion Detail Logging (SHC002 only) ────────────────────────── */}
      {def.hasDetailLog && (
        <div style={{ backgroundColor: T.detailBg, borderTop: `2px solid ${T.border}`, padding: "14px 20px" }}>
          <div style={{ fontWeight: "bold", fontSize: 15, color: T.textDark, marginBottom: 12 }}>
            Devotion Detail Logging:
          </div>

          {/* Two-column layout: Sun–Wed | Thu–Sat */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Headers */}
            {[0, 1].map((col) => (
              <div key={col} style={{ display: "grid", gridTemplateColumns: "44px 1fr 1fr", gap: 6, alignItems: "center" }}>
                <div style={{ fontSize: 11, fontWeight: "bold", color: T.textMid }}></div>
                <div style={{ fontSize: 11, fontWeight: "bold", color: T.textMid }}>Devotion Type</div>
                <div style={{ fontSize: 11, fontWeight: "bold", color: T.textMid }}>Devotion Details</div>
              </div>
            ))}

            {/* Left: Sun–Wed (days 0–3) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[0, 1, 2, 3].map((d) => (
                <div key={d} style={{
                  display: "grid", gridTemplateColumns: "44px 1fr 1fr", gap: 6, alignItems: "center",
                  backgroundColor: T.detailRow, borderRadius: 6, padding: "6px 8px",
                }}>
                  <div style={{ fontSize: 12, fontWeight: "bold", color: T.textDark }}>{DAY_LABELS[d]}</div>
                  <select
                    value={st.detailLog[d].type}
                    onChange={(e) => setDetailType(d, e.target.value)}
                    style={{
                      padding: "4px 6px", borderRadius: 5, border: `1.5px solid ${T.border}`,
                      backgroundColor: T.headerBg, color: T.textDark, fontSize: 11, cursor: "pointer",
                    }}
                  >
                    {DEVOTION_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <input
                    type="text"
                    value={st.detailLog[d].details}
                    onChange={(e) => setDetailText(d, e.target.value)}
                    style={{
                      padding: "4px 6px", borderRadius: 5, border: `1.5px solid ${T.border}`,
                      backgroundColor: T.headerBg, color: T.textDark, fontSize: 11,
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Right: Thu–Sat (days 4–6) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[4, 5, 6].map((d) => (
                <div key={d} style={{
                  display: "grid", gridTemplateColumns: "44px 1fr 1fr", gap: 6, alignItems: "center",
                  backgroundColor: T.detailRow, borderRadius: 6, padding: "6px 8px",
                }}>
                  <div style={{ fontSize: 12, fontWeight: "bold", color: T.textDark }}>{DAY_LABELS[d]}</div>
                  <select
                    value={st.detailLog[d].type}
                    onChange={(e) => setDetailType(d, e.target.value)}
                    style={{
                      padding: "4px 6px", borderRadius: 5, border: `1.5px solid ${T.border}`,
                      backgroundColor: T.headerBg, color: T.textDark, fontSize: 11, cursor: "pointer",
                    }}
                  >
                    {DEVOTION_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <input
                    type="text"
                    value={st.detailLog[d].details}
                    onChange={(e) => setDetailText(d, e.target.value)}
                    style={{
                      padding: "4px 6px", borderRadius: 5, border: `1.5px solid ${T.border}`,
                      backgroundColor: T.headerBg, color: T.textDark, fontSize: 11,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────
export function HabitCard() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.pageBg, padding: "24px", fontFamily: "'Georgia', serif" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        <HabitCardBlock def={PRAYER} />
        <HabitCardBlock def={DEVOTION} />
      </div>
    </div>
  );
}
