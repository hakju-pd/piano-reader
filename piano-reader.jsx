import { useState, useEffect, useCallback, useRef } from "react";

// ─── Music Data ───────────────────────────────────────────────
const WHITE_NOTES = ["C", "D", "E", "F", "G", "A", "B"];
const ALL_NOTES_IN_OCTAVE = [
  { name: "C", isBlack: false },
  { name: "C#", isBlack: true, displayName: "C♯" },
  { name: "D", isBlack: false },
  { name: "D#", isBlack: true, displayName: "E♭" },
  { name: "E", isBlack: false },
  { name: "F", isBlack: false },
  { name: "F#", isBlack: true, displayName: "F♯" },
  { name: "G", isBlack: false },
  { name: "G#", isBlack: true, displayName: "A♭" },
  { name: "A", isBlack: false },
  { name: "A#", isBlack: true, displayName: "B♭" },
  { name: "B", isBlack: false },
];

// How to display accidentals: some as sharps, some as flats
const ACCIDENTAL_DISPLAY = {
  "C#": { accidental: "♯", staffNote: "C", displayName: "C♯" },
  "D#": { accidental: "♭", staffNote: "E", displayName: "E♭" },
  "F#": { accidental: "♯", staffNote: "F", displayName: "F♯" },
  "G#": { accidental: "♭", staffNote: "A", displayName: "A♭" },
  "A#": { accidental: "♭", staffNote: "B", displayName: "B♭" },
};

// ─── Staff position logic ─────────────────────────────────────
// Treble clef: bottom line = E4 = pos 0
//   C4=-2, D4=-1, E4=0, F4=1, G4=2, A4=3, B4=4, C5=5, D5=6, E5=7 ...
// Bass clef: bottom line = G2 = pos 0
//   G2=0, A2=1, B2=2, C3=3, D3=4, E3=5, F3=6, G3=7, A3=8, B3=9, C4=10
function getStaffPosition(noteName, octave, clef) {
  let diatonic = noteName;
  if (ACCIDENTAL_DISPLAY[noteName]) {
    diatonic = ACCIDENTAL_DISPLAY[noteName].staffNote;
  }
  const idx = WHITE_NOTES.indexOf(diatonic);

  if (clef === "treble") {
    // E4=0 → idx of E is 2, octave 4 → (4-4)*7 + 2 - 2 = 0 ✓
    return (octave - 4) * 7 + idx - 2;
  } else {
    // G2=0 → idx of G is 4, octave 2 → (2-2)*7 + 4 - 4 = 0 ✓
    return (octave - 2) * 7 + idx - 4;
  }
}

// ─── Build note pool ──────────────────────────────────────────
function getAllNotes(clef, includeAccidentals) {
  const notes = [];
  if (clef === "treble" || clef === "both") {
    for (let o = 4; o <= 5; o++) {
      for (const n of ALL_NOTES_IN_OCTAVE) {
        if (!includeAccidentals && n.isBlack) continue;
        notes.push({ note: n.name, octave: o, clef: "treble", isBlack: n.isBlack });
      }
    }
    notes.push({ note: "C", octave: 6, clef: "treble", isBlack: false });
  }
  if (clef === "bass" || clef === "both") {
    for (let o = 2; o <= 3; o++) {
      for (const n of ALL_NOTES_IN_OCTAVE) {
        if (!includeAccidentals && n.isBlack) continue;
        notes.push({ note: n.name, octave: o, clef: "bass", isBlack: n.isBlack });
      }
    }
    notes.push({ note: "C", octave: 4, clef: "bass", isBlack: false });
  }
  return notes;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── SVG Staff Component ──────────────────────────────────────
function Staff({ currentNote, showAnswer, wasCorrect, dim }) {
  const { note, octave, clef } = currentNote;
  const pos = getStaffPosition(note, octave, clef);

  const staffTop = 52;
  const gap = 13;
  const noteX = 195;
  const alpha = dim ? 0.22 : 1;

  const bottomY = staffTop + 4 * gap;
  const noteY = bottomY - pos * (gap / 2);

  // Ledger lines
  const ledgers = [];
  if (pos < 0) {
    for (let p = pos % 2 === 0 ? pos : pos - 1; p <= -2; p += 2) {
      ledgers.push(bottomY - p * (gap / 2));
    }
  }
  if (pos > 8) {
    for (let p = 10; p <= (pos % 2 === 0 ? pos : pos + 1); p += 2) {
      ledgers.push(bottomY - p * (gap / 2));
    }
  }

  const accInfo = ACCIDENTAL_DISPLAY[note];
  const hasAccidental = !!accInfo && !dim;

  let noteColor = dim ? "#4a4560" : "#e8e0d4";
  if (showAnswer && !dim) {
    noteColor = wasCorrect ? "#2ecc71" : "#e74c3c";
  }

  const isTreble = clef === "treble";

  return (
    <svg viewBox="0 0 390 150" style={{ width: "100%", maxWidth: 450, opacity: alpha, transition: "opacity 0.3s" }}>
      {/* Five staff lines */}
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1={32} x2={358} y1={staffTop + i * gap} y2={staffTop + i * gap}
          stroke={dim ? "#332e48" : "#5e567a"} strokeWidth={1.1} />
      ))}

      {/* Clef */}
      {isTreble ? (
        /* Treble: G-curl wraps around the G4 line, which is position 2 = staffTop + 2*gap from top
           The 𝄞 glyph's curl center is roughly at 0.68× of its font-size below the text anchor.
           Placing text y so that the curl aligns with the 2nd line from bottom (= staffTop + 2*gap). */
        <text x={42} y={staffTop + 4.05 * gap} fontSize={58}
          fill={dim ? "#3a3555" : "#a89ec4"} fontFamily="'Noto Music','Segoe UI Symbol',serif">
          𝄞
        </text>
      ) : (
        /* Bass: The two dots sit around the F line (2nd from top = staffTop + gap).
           The 𝄢 glyph's colon is roughly at 0.35× from top of glyph. */
        <text x={42} y={staffTop + 2.55 * gap} fontSize={36}
          fill={dim ? "#3a3555" : "#a89ec4"} fontFamily="'Noto Music','Segoe UI Symbol',serif">
          𝄢
        </text>
      )}

      {/* Ledger lines */}
      {!dim && ledgers.map((ly, i) => (
        <line key={`l${i}`} x1={noteX - 17} x2={noteX + 17} y1={ly} y2={ly}
          stroke="#5e567a" strokeWidth={1.1} />
      ))}

      {/* Accidental */}
      {hasAccidental && (
        <text x={noteX - 20} y={noteY + 5} fontSize={17} fill={noteColor}
          fontFamily="serif" textAnchor="end" style={{ transition: "fill 0.2s" }}>
          {accInfo.accidental}
        </text>
      )}

      {/* Note head */}
      {!dim && (
        <ellipse cx={noteX} cy={noteY} rx={8.5} ry={6} fill={noteColor}
          transform={`rotate(-14, ${noteX}, ${noteY})`}
          style={{ transition: "fill 0.2s" }} />
      )}

      {/* Stem */}
      {!dim && (pos < 4 ? (
        <line x1={noteX + 8} y1={noteY - 1} x2={noteX + 8} y2={noteY - 36}
          stroke={noteColor} strokeWidth={1.5} style={{ transition: "stroke 0.2s" }} />
      ) : (
        <line x1={noteX - 8} y1={noteY + 1} x2={noteX - 8} y2={noteY + 36}
          stroke={noteColor} strokeWidth={1.5} style={{ transition: "stroke 0.2s" }} />
      ))}

      {/* Answer label */}
      {showAnswer && !dim && (
        <text x={noteX + 28} y={noteY + 5} textAnchor="start" fontSize={15} fontWeight="700"
          fill={noteColor} fontFamily="'DM Mono', monospace">
          {accInfo ? accInfo.displayName : note}{octave}
        </text>
      )}
    </svg>
  );
}

// ─── Piano Keyboard ───────────────────────────────────────────
const WW = 34;
const WH = 110;
const BW = 20;
const BH = 66;

const BLACK_OFFSET = { "C#": 0.62, "D#": 0.85, "F#": 0.62, "G#": 0.73, "A#": 0.86 };

function Piano({ onKeyPress, highlight, range, includeAccidentals }) {
  const [startO, endO] = range;
  const whites = [];
  const blacks = [];
  let wi = 0;

  for (let o = startO; o <= endO; o++) {
    for (const n of ALL_NOTES_IN_OCTAVE) {
      if (o === endO && n.name !== "C") continue;
      if (!n.isBlack) {
        const x = wi * (WW + 2);
        whites.push({ name: n.name, octave: o, x, id: `${n.name}${o}` });
        wi++;
      } else if (includeAccidentals) {
        const prevX = (wi - 1) * (WW + 2);
        const frac = BLACK_OFFSET[n.name] || 0.65;
        const x = prevX + WW * frac - BW / 2 + 1;
        blacks.push({ name: n.name, displayName: n.displayName || n.name, octave: o, x, id: `${n.name}${o}` });
      }
    }
  }

  const totalW = wi * (WW + 2);

  return (
    <div style={{ overflowX: "auto", display: "flex", justifyContent: "center", paddingBottom: 4 }}>
      <div style={{ position: "relative", width: totalW, height: WH + 2, flexShrink: 0 }}>
        {whites.map((k) => {
          const hl = highlight === k.id;
          return (
            <button key={k.id} onClick={() => onKeyPress(k.name, k.octave)}
              style={{
                position: "absolute", left: k.x, top: 0, width: WW, height: WH,
                background: hl
                  ? "linear-gradient(180deg, #f5e8c8 0%, #e0c880 100%)"
                  : "linear-gradient(180deg, #faf6f0 0%, #ede5d8 100%)",
                border: "1px solid #c5b99a", borderTop: "none",
                borderRadius: "0 0 5px 5px", cursor: "pointer", zIndex: 1,
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                paddingBottom: 5, boxShadow: "0 2px 4px rgba(0,0,0,0.18)",
                transition: "background 0.1s",
              }}>
              <span style={{ fontSize: 9, color: "#9a8e78", fontFamily: "'DM Mono',monospace", pointerEvents: "none" }}>
                {k.name}<span style={{ fontSize: 7 }}>{k.octave}</span>
              </span>
            </button>
          );
        })}
        {blacks.map((k) => {
          const hl = highlight === k.id;
          return (
            <button key={k.id} onClick={() => onKeyPress(k.name, k.octave)}
              style={{
                position: "absolute", left: k.x, top: 0, width: BW, height: BH,
                background: hl
                  ? "linear-gradient(180deg, #6a5a38 0%, #3a2a10 100%)"
                  : "linear-gradient(180deg, #2c2c30 0%, #181818 100%)",
                border: "1px solid #0a0a0a", borderTop: "none",
                borderRadius: "0 0 3px 3px", cursor: "pointer", zIndex: 2,
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                paddingBottom: 4,
                boxShadow: "0 3px 6px rgba(0,0,0,0.5), inset 0 -1px 3px rgba(255,255,255,0.04)",
                transition: "background 0.1s",
              }}>
              <span style={{ fontSize: 7, color: "#666", fontFamily: "'DM Mono',monospace", pointerEvents: "none" }}>
                {k.displayName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Stats ────────────────────────────────────────────────────
function Stats({ correct, total, streak, bestStreak }) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <div style={{
      display: "flex", justifyContent: "center", gap: 20, padding: "8px 0",
      fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#7a7490",
    }}>
      <div>
        <span style={{ color: "#2ecc71", fontWeight: 700 }}>{correct}</span>
        <span style={{ opacity: 0.4 }}>/{total}</span>
        <span style={{ opacity: 0.35, marginLeft: 3 }}>({pct}%)</span>
      </div>
      <div>streak <span style={{ color: "#e8a838", fontWeight: 700 }}>{streak}</span></div>
      <div>best <span style={{ color: "#c084fc", fontWeight: 700 }}>{bestStreak}</span></div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export default function SightReadingTrainer() {
  const [clef, setClef] = useState("treble");
  const [includeAcc, setIncludeAcc] = useState(true);
  const [allNotes, setAllNotes] = useState(() => getAllNotes("treble", true));
  const [current, setCurrent] = useState(() => pickRandom(getAllNotes("treble", true)));
  const [showAnswer, setShowAnswer] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [highlight, setHighlight] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const notes = getAllNotes(clef, includeAcc);
    setAllNotes(notes);
    setCurrent(pickRandom(notes));
    setShowAnswer(false);
    setCorrect(0); setTotal(0); setStreak(0); setBestStreak(0);
    setFeedback(null); setHighlight(null);
  }, [clef, includeAcc]);

  const nextNote = useCallback(() => {
    let next = pickRandom(allNotes);
    let tries = 0;
    while (next.note === current.note && next.octave === current.octave && tries < 20) {
      next = pickRandom(allNotes); tries++;
    }
    setCurrent(next);
    setShowAnswer(false);
    setHighlight(null);
    setFeedback(null);
  }, [allNotes, current]);

  const handleKeyPress = useCallback((noteName, octave) => {
    if (showAnswer) return;
    const isCorrect = noteName === current.note;
    setShowAnswer(true);
    setWasCorrect(isCorrect);
    setTotal((t) => t + 1);
    setHighlight(`${current.note}${current.octave}`);

    if (isCorrect) {
      setCorrect((c) => c + 1);
      setStreak((s) => { const ns = s + 1; setBestStreak((b) => Math.max(b, ns)); return ns; });
      setFeedback(pickRandom(["Nice!", "Correct!", "Yes!", "♪", "Perfect!", "Nailed it!"]));
    } else {
      setStreak(0);
      const disp = ACCIDENTAL_DISPLAY[current.note]?.displayName || current.note;
      setFeedback(`Nope — it was ${disp}${current.octave}`);
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(nextNote, isCorrect ? 700 : 1600);
  }, [current, showAnswer, nextNote]);

  const pianoRange = clef === "bass" ? [2, 4] : clef === "treble" ? [4, 6] : [2, 6];

  const dummyBassNote = { note: "C", octave: 3, clef: "bass", isBlack: false };
  const dummyTrebleNote = { note: "C", octave: 5, clef: "treble", isBlack: false };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0f0c1a 0%, #161230 40%, #0e1a28 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "20px 10px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet" />

      <h1 style={{
        fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 900,
        color: "#faf6f0", letterSpacing: "-0.5px", marginBottom: 2,
      }}>
        Sight Reading
      </h1>
      <p style={{ color: "#5e567a", fontSize: 11, marginTop: 0, marginBottom: 14, letterSpacing: 3 }}>
        IDENTIFY THE NOTE
      </p>

      {/* Clef selector */}
      <div style={{ display: "flex", gap: 5, marginBottom: 6, flexWrap: "wrap", justifyContent: "center" }}>
        {["treble", "bass", "both"].map((c) => (
          <button key={c} onClick={() => setClef(c)}
            style={{
              background: clef === c ? "#e8a838" : "rgba(255,255,255,0.04)",
              color: clef === c ? "#12101e" : "#6b6280",
              border: "none", borderRadius: 20, padding: "5px 14px",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
              fontFamily: "'DM Mono',monospace",
              transition: "all 0.2s",
            }}>
            {c === "both" ? "Grand Staff" : `${c} clef`}
          </button>
        ))}
      </div>

      {/* Accidentals toggle */}
      <button onClick={() => setIncludeAcc((v) => !v)}
        style={{
          background: includeAcc ? "rgba(200,132,252,0.12)" : "rgba(255,255,255,0.03)",
          color: includeAcc ? "#c084fc" : "#4a4460",
          border: `1px solid ${includeAcc ? "rgba(200,132,252,0.25)" : "rgba(255,255,255,0.06)"}`,
          borderRadius: 20, padding: "4px 14px", fontSize: 11, cursor: "pointer",
          fontFamily: "'DM Mono',monospace", marginBottom: 12, transition: "all 0.2s",
        }}>
        {includeAcc ? "♯♭ accidentals on" : "♯♭ accidentals off"}
      </button>

      {/* Staff */}
      <div style={{
        background: "rgba(255,255,255,0.025)", borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.06)",
        padding: "8px 6px 2px", marginBottom: 4, width: "100%", maxWidth: 470,
      }}>
        {clef === "both" ? (
          <>
            {current.clef === "treble" ? (
              <Staff currentNote={current} showAnswer={showAnswer} wasCorrect={wasCorrect} dim={false} />
            ) : (
              <Staff currentNote={dummyTrebleNote} showAnswer={false} wasCorrect={false} dim={true} />
            )}
            <div style={{ height: 0, borderTop: "1px dashed rgba(255,255,255,0.05)", margin: "0 50px" }} />
            {current.clef === "bass" ? (
              <Staff currentNote={current} showAnswer={showAnswer} wasCorrect={wasCorrect} dim={false} />
            ) : (
              <Staff currentNote={dummyBassNote} showAnswer={false} wasCorrect={false} dim={true} />
            )}
          </>
        ) : (
          <Staff currentNote={current} showAnswer={showAnswer} wasCorrect={wasCorrect} dim={false} />
        )}
      </div>

      {/* Feedback */}
      <div style={{
        height: 26, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 600,
        color: wasCorrect ? "#2ecc71" : "#e74c3c",
        opacity: feedback ? 1 : 0, transition: "opacity 0.15s",
        fontFamily: "'DM Mono',monospace",
      }}>
        {feedback}
      </div>

      <Stats correct={correct} total={total} streak={streak} bestStreak={bestStreak} />

      {/* Piano */}
      <div style={{
        background: "rgba(0,0,0,0.35)", borderRadius: 14,
        padding: "12px 10px 8px", width: "100%", maxWidth: 600, marginTop: 4,
        border: "1px solid rgba(255,255,255,0.04)",
      }}>
        <Piano onKeyPress={handleKeyPress} highlight={highlight} range={pianoRange} includeAccidentals={includeAcc} />
      </div>

      <button onClick={() => { clearTimeout(timerRef.current); nextNote(); }}
        style={{
          marginTop: 14, background: "none",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "#5e567a", borderRadius: 20, padding: "5px 22px",
          fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono',monospace",
        }}>
        skip →
      </button>
    </div>
  );
}
