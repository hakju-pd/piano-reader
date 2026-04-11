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

const ACCIDENTAL_DISPLAY = {
  "C#": { accidental: "♯", staffNote: "C", displayName: "C♯" },
  "D#": { accidental: "♭", staffNote: "E", displayName: "E♭" },
  "F#": { accidental: "♯", staffNote: "F", displayName: "F♯" },
  "G#": { accidental: "♭", staffNote: "A", displayName: "A♭" },
  "A#": { accidental: "♭", staffNote: "B", displayName: "B♭" },
};

// ─── Intervals ────────────────────────────────────────────────
const INTERVALS = [
  { semitones: 0, name: "Unison", short: "P1", color: "#888" },
  { semitones: 1, name: "Minor 2nd", short: "m2", color: "#e74c3c" },
  { semitones: 2, name: "Major 2nd", short: "M2", color: "#e88438" },
  { semitones: 3, name: "Minor 3rd", short: "m3", color: "#e8a838" },
  { semitones: 4, name: "Major 3rd", short: "M3", color: "#d4e838" },
  { semitones: 5, name: "Perfect 4th", short: "P4", color: "#5be838" },
  { semitones: 6, name: "Tritone", short: "TT", color: "#38e8c4" },
  { semitones: 7, name: "Perfect 5th", short: "P5", color: "#389be8" },
  { semitones: 8, name: "Minor 6th", short: "m6", color: "#5038e8" },
  { semitones: 9, name: "Major 6th", short: "M6", color: "#8838e8" },
  { semitones: 10, name: "Minor 7th", short: "m7", color: "#c838e8" },
  { semitones: 11, name: "Major 7th", short: "M7", color: "#e838a8" },
  { semitones: 12, name: "Octave", short: "P8", color: "#c084fc" },
];

// ─── Audio Engine ─────────────────────────────────────────────
const SEMITONE_MAP = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteToFrequency(noteName, octave) {
  const midi = 12 + octave * 12 + SEMITONE_MAP[noteName];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function midiToNote(midi) {
  const octave = Math.floor(midi / 12) - 1;
  const name = CHROMATIC[midi % 12];
  return { name, octave };
}

function noteToMidi(noteName, octave) {
  return 12 + octave * 12 + SEMITONE_MAP[noteName];
}

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playNote(noteName, octave, duration = 0.8) {
  const ctx = getAudioCtx();
  const freq = noteToFrequency(noteName, octave);
  const now = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc1.type = "triangle";
  osc1.frequency.setValueAtTime(freq, now);
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(freq * 1.002, now);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(Math.min(freq * 6, 8000), now);
  filter.Q.setValueAtTime(0.7, now);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.28, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + duration + 0.05);
  osc2.stop(now + duration + 0.05);

  setTimeout(() => {
    osc1.disconnect(); osc2.disconnect(); filter.disconnect(); gain.disconnect();
  }, (duration + 0.1) * 1000);
}

function playInterval(note1Name, note1Oct, note2Name, note2Oct, mode = "ascending") {
  const dur = 0.9;
  if (mode === "harmonic") {
    playNote(note1Name, note1Oct, dur);
    playNote(note2Name, note2Oct, dur);
  } else if (mode === "ascending") {
    playNote(note1Name, note1Oct, dur);
    setTimeout(() => playNote(note2Name, note2Oct, dur), 650);
  } else {
    playNote(note2Name, note2Oct, dur);
    setTimeout(() => playNote(note1Name, note1Oct, dur), 650);
  }
}

// ─── Staff position logic ─────────────────────────────────────
function getStaffPosition(noteName, octave, clef) {
  let diatonic = noteName;
  if (ACCIDENTAL_DISPLAY[noteName]) diatonic = ACCIDENTAL_DISPLAY[noteName].staffNote;
  const idx = WHITE_NOTES.indexOf(diatonic);
  if (clef === "treble") return (octave - 4) * 7 + idx - 2;
  else return (octave - 2) * 7 + idx - 4;
}

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

// ─── SVG Staff ────────────────────────────────────────────────
function Staff({ currentNote, showAnswer, wasCorrect, dim }) {
  const { note, octave, clef } = currentNote;
  const pos = getStaffPosition(note, octave, clef);
  const staffTop = 52;
  const gap = 13;
  const noteX = 195;
  const alpha = dim ? 0.22 : 1;
  const bottomY = staffTop + 4 * gap;
  const noteY = bottomY - pos * (gap / 2);

  const ledgers = [];
  if (pos < 0) {
    for (let p = pos % 2 === 0 ? pos : pos - 1; p <= -2; p += 2) ledgers.push(bottomY - p * (gap / 2));
  }
  if (pos > 8) {
    for (let p = 10; p <= (pos % 2 === 0 ? pos : pos + 1); p += 2) ledgers.push(bottomY - p * (gap / 2));
  }

  const accInfo = ACCIDENTAL_DISPLAY[note];
  const hasAccidental = !!accInfo && !dim;
  let noteColor = dim ? "#4a4560" : "#e8e0d4";
  if (showAnswer && !dim) noteColor = wasCorrect ? "#2ecc71" : "#e74c3c";
  const isTreble = clef === "treble";

  return (
    <svg viewBox="0 0 390 150" style={{ width: "100%", maxWidth: 450, opacity: alpha, transition: "opacity 0.3s" }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1={32} x2={358} y1={staffTop + i * gap} y2={staffTop + i * gap}
          stroke={dim ? "#332e48" : "#5e567a"} strokeWidth={1.1} />
      ))}
      {isTreble ? (
        <text x={42} y={staffTop + 4.05 * gap} fontSize={58}
          fill={dim ? "#3a3555" : "#a89ec4"} fontFamily="'Noto Music','Segoe UI Symbol',serif">𝄞</text>
      ) : (
        <text x={42} y={staffTop + 2.55 * gap} fontSize={36}
          fill={dim ? "#3a3555" : "#a89ec4"} fontFamily="'Noto Music','Segoe UI Symbol',serif">𝄢</text>
      )}
      {!dim && ledgers.map((ly, i) => (
        <line key={`l${i}`} x1={noteX - 17} x2={noteX + 17} y1={ly} y2={ly} stroke="#5e567a" strokeWidth={1.1} />
      ))}
      {hasAccidental && (
        <text x={noteX - 20} y={noteY + 5} fontSize={17} fill={noteColor}
          fontFamily="serif" textAnchor="end" style={{ transition: "fill 0.2s" }}>{accInfo.accidental}</text>
      )}
      {!dim && (
        <ellipse cx={noteX} cy={noteY} rx={8.5} ry={6} fill={noteColor}
          transform={`rotate(-14, ${noteX}, ${noteY})`} style={{ transition: "fill 0.2s" }} />
      )}
      {!dim && (pos < 4 ? (
        <line x1={noteX + 8} y1={noteY - 1} x2={noteX + 8} y2={noteY - 36}
          stroke={noteColor} strokeWidth={1.5} style={{ transition: "stroke 0.2s" }} />
      ) : (
        <line x1={noteX - 8} y1={noteY + 1} x2={noteX - 8} y2={noteY + 36}
          stroke={noteColor} strokeWidth={1.5} style={{ transition: "stroke 0.2s" }} />
      ))}
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
  const [pressed, setPressed] = useState(null);
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
  const handlePress = (name, octave, id) => {
    playNote(name, octave);
    onKeyPress(name, octave);
    setPressed(id);
    setTimeout(() => setPressed(null), 150);
  };

  return (
    <div style={{ overflowX: "auto", display: "flex", justifyContent: "center", paddingBottom: 4 }}>
      <div style={{ position: "relative", width: totalW, height: WH + 2, flexShrink: 0 }}>
        {whites.map((k) => {
          const hl = highlight === k.id;
          const pr = pressed === k.id;
          return (
            <button key={k.id} onClick={() => handlePress(k.name, k.octave, k.id)}
              style={{
                position: "absolute", left: k.x, top: 0, width: WW, height: WH,
                background: hl ? "linear-gradient(180deg, #f5e8c8 0%, #e0c880 100%)"
                  : pr ? "linear-gradient(180deg, #e8e0d0 0%, #d5cdb8 100%)"
                    : "linear-gradient(180deg, #faf6f0 0%, #ede5d8 100%)",
                border: "1px solid #c5b99a", borderTop: "none",
                borderRadius: "0 0 5px 5px", cursor: "pointer", zIndex: 1,
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                paddingBottom: 5,
                boxShadow: pr ? "0 1px 2px rgba(0,0,0,0.1)" : "0 2px 4px rgba(0,0,0,0.18)",
                transform: pr ? "translateY(1px)" : "none",
                transition: "background 0.08s, box-shadow 0.08s, transform 0.08s",
              }}>
              <span style={{ fontSize: 9, color: "#9a8e78", fontFamily: "'DM Mono',monospace", pointerEvents: "none" }}>
                {k.name}<span style={{ fontSize: 7 }}>{k.octave}</span>
              </span>
            </button>
          );
        })}
        {blacks.map((k) => {
          const hl = highlight === k.id;
          const pr = pressed === k.id;
          return (
            <button key={k.id} onClick={() => handlePress(k.name, k.octave, k.id)}
              style={{
                position: "absolute", left: k.x, top: 0, width: BW, height: BH,
                background: hl ? "linear-gradient(180deg, #6a5a38 0%, #3a2a10 100%)"
                  : pr ? "linear-gradient(180deg, #3a3a40 0%, #222 100%)"
                    : "linear-gradient(180deg, #2c2c30 0%, #181818 100%)",
                border: "1px solid #0a0a0a", borderTop: "none",
                borderRadius: "0 0 3px 3px", cursor: "pointer", zIndex: 2,
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                paddingBottom: 4,
                boxShadow: pr ? "0 1px 3px rgba(0,0,0,0.3)" : "0 3px 6px rgba(0,0,0,0.5), inset 0 -1px 3px rgba(255,255,255,0.04)",
                transform: pr ? "translateY(1px)" : "none",
                transition: "background 0.08s, box-shadow 0.08s, transform 0.08s",
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

// ─── Stats (shared) ───────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════
// MODE 1: SIGHT READING
// ═══════════════════════════════════════════════════════════════
function SightReadingMode() {
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
  const [listenPulse, setListenPulse] = useState(false);
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
    setCurrent(next); setShowAnswer(false); setHighlight(null); setFeedback(null);
  }, [allNotes, current]);

  const handleKeyPress = useCallback((noteName, octave) => {
    if (showAnswer) return;
    const isCorrect = noteName === current.note;
    setShowAnswer(true); setWasCorrect(isCorrect);
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
      setTimeout(() => playNote(current.note, current.octave, 1.0), 400);
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(nextNote, isCorrect ? 800 : 2000);
  }, [current, showAnswer, nextNote]);

  const handleListen = () => {
    playNote(current.note, current.octave, 1.2);
    setListenPulse(true);
    setTimeout(() => setListenPulse(false), 300);
  };

  const pianoRange = clef === "bass" ? [2, 4] : clef === "treble" ? [4, 6] : [2, 6];
  const dummyBass = { note: "C", octave: 3, clef: "bass", isBlack: false };
  const dummyTreble = { note: "C", octave: 5, clef: "treble", isBlack: false };

  return (
    <>
      {/* Clef selector */}
      <div style={{ display: "flex", gap: 5, marginBottom: 6, flexWrap: "wrap", justifyContent: "center" }}>
        {["treble", "bass", "both"].map((c) => (
          <button key={c} onClick={() => setClef(c)}
            style={{
              background: clef === c ? "#e8a838" : "rgba(255,255,255,0.04)",
              color: clef === c ? "#12101e" : "#6b6280",
              border: "none", borderRadius: 20, padding: "5px 14px",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
              fontFamily: "'DM Mono',monospace", transition: "all 0.2s",
            }}>
            {c === "both" ? "Grand Staff" : `${c} clef`}
          </button>
        ))}
      </div>
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
            {current.clef === "treble"
              ? <Staff currentNote={current} showAnswer={showAnswer} wasCorrect={wasCorrect} dim={false} />
              : <Staff currentNote={dummyTreble} showAnswer={false} wasCorrect={false} dim={true} />}
            <div style={{ height: 0, borderTop: "1px dashed rgba(255,255,255,0.05)", margin: "0 50px" }} />
            {current.clef === "bass"
              ? <Staff currentNote={current} showAnswer={showAnswer} wasCorrect={wasCorrect} dim={false} />
              : <Staff currentNote={dummyBass} showAnswer={false} wasCorrect={false} dim={true} />}
          </>
        ) : (
          <Staff currentNote={current} showAnswer={showAnswer} wasCorrect={wasCorrect} dim={false} />
        )}
      </div>

      {/* Listen + feedback */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, height: 36, marginBottom: 2 }}>
        <button onClick={handleListen}
          style={{
            background: listenPulse ? "rgba(232,168,56,0.25)" : "rgba(232,168,56,0.10)",
            color: "#e8a838",
            border: `1px solid ${listenPulse ? "rgba(232,168,56,0.5)" : "rgba(232,168,56,0.2)"}`,
            borderRadius: 20, padding: "5px 16px", fontSize: 12, fontWeight: 600,
            cursor: "pointer", fontFamily: "'DM Mono',monospace",
            transition: "all 0.15s", transform: listenPulse ? "scale(1.05)" : "scale(1)",
          }}>♪ listen</button>
        <div style={{
          fontSize: 14, fontWeight: 600,
          color: wasCorrect ? "#2ecc71" : "#e74c3c",
          opacity: feedback ? 1 : 0, transition: "opacity 0.15s",
          fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap",
        }}>{feedback}</div>
      </div>

      <Stats correct={correct} total={total} streak={streak} bestStreak={bestStreak} />

      <div style={{
        background: "rgba(0,0,0,0.35)", borderRadius: 14,
        padding: "12px 10px 8px", width: "100%", maxWidth: 600, marginTop: 4,
        border: "1px solid rgba(255,255,255,0.04)",
      }}>
        <Piano onKeyPress={handleKeyPress} highlight={highlight} range={pianoRange} includeAccidentals={includeAcc} />
      </div>

      <button onClick={() => { clearTimeout(timerRef.current); nextNote(); }}
        style={{
          marginTop: 14, background: "none", border: "1px solid rgba(255,255,255,0.08)",
          color: "#5e567a", borderRadius: 20, padding: "5px 22px",
          fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono',monospace",
        }}>skip →</button>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODE 2: INTERVAL EAR TRAINING
// ═══════════════════════════════════════════════════════════════
function IntervalMode() {
  const [enabledIntervals, setEnabledIntervals] = useState(
    () => new Set([1, 2, 3, 4, 5, 7, 12])
  );
  const [direction, setDirection] = useState("ascending"); // ascending | descending | harmonic
  const [currentInterval, setCurrentInterval] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [listenPulse, setListenPulse] = useState(false);
  const timerRef = useRef(null);

  const generateInterval = useCallback(() => {
    const enabled = INTERVALS.filter((iv) => enabledIntervals.has(iv.semitones));
    if (enabled.length === 0) return;
    const interval = pickRandom(enabled);

    // Pick a random root note between C3 and C5, leaving room for the interval above
    const minMidi = noteToMidi("C", 3);
    const maxMidi = noteToMidi("C", 5) - interval.semitones;
    const rootMidi = minMidi + Math.floor(Math.random() * Math.max(1, maxMidi - minMidi + 1));
    const topMidi = rootMidi + interval.semitones;

    const root = midiToNote(rootMidi);
    const top = midiToNote(topMidi);

    return {
      interval,
      root,
      top,
      direction: direction === "ascending" ? "ascending"
        : direction === "descending" ? "descending"
          : pickRandom(["ascending", "descending"]),
    };
  }, [enabledIntervals, direction]);

  const newRound = useCallback(() => {
    const iv = generateInterval();
    if (!iv) return;
    setCurrentInterval(iv);
    setShowAnswer(false);
    setWasCorrect(false);
    setFeedback(null);
    // Auto-play the interval
    setTimeout(() => {
      playInterval(iv.root.name, iv.root.octave, iv.top.name, iv.top.octave, iv.direction);
    }, 300);
  }, [generateInterval]);

  useEffect(() => {
    newRound();
  }, [enabledIntervals, direction]);

  const handleReplay = () => {
    if (!currentInterval) return;
    const iv = currentInterval;
    playInterval(iv.root.name, iv.root.octave, iv.top.name, iv.top.octave, iv.direction);
    setListenPulse(true);
    setTimeout(() => setListenPulse(false), 300);
  };

  const handleGuess = (semitones) => {
    if (showAnswer || !currentInterval) return;
    const isCorrect = semitones === currentInterval.interval.semitones;
    setShowAnswer(true);
    setWasCorrect(isCorrect);
    setTotal((t) => t + 1);

    if (isCorrect) {
      setCorrect((c) => c + 1);
      setStreak((s) => { const ns = s + 1; setBestStreak((b) => Math.max(b, ns)); return ns; });
      setFeedback(pickRandom(["Nailed it!", "Correct!", "Yes!", "♪", "Perfect!", "Great ear!"]));
    } else {
      setStreak(0);
      setFeedback(`Nope — it was ${currentInterval.interval.name}`);
    }

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => newRound(), isCorrect ? 1000 : 2200);
  };

  const toggleInterval = (semitones) => {
    setEnabledIntervals((prev) => {
      const next = new Set(prev);
      if (next.has(semitones)) {
        if (next.size > 2) next.delete(semitones); // keep at least 2
      } else {
        next.add(semitones);
      }
      return next;
    });
  };

  const enabledList = INTERVALS.filter((iv) => enabledIntervals.has(iv.semitones));

  return (
    <>
      {/* Direction selector */}
      <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {[
          { key: "ascending", label: "↑ ascending" },
          { key: "descending", label: "↓ descending" },
          { key: "harmonic", label: "⟺ harmonic" },
        ].map((d) => (
          <button key={d.key} onClick={() => setDirection(d.key)}
            style={{
              background: direction === d.key ? "#e8a838" : "rgba(255,255,255,0.04)",
              color: direction === d.key ? "#12101e" : "#6b6280",
              border: "none", borderRadius: 20, padding: "5px 14px",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
              fontFamily: "'DM Mono',monospace", transition: "all 0.2s",
            }}>
            {d.label}
          </button>
        ))}
      </div>

      {/* Settings toggle */}
      <button onClick={() => setShowSettings((v) => !v)}
        style={{
          background: "rgba(255,255,255,0.04)",
          color: "#6b6280", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20, padding: "4px 14px", fontSize: 10, cursor: "pointer",
          fontFamily: "'DM Mono',monospace", marginBottom: 10,
        }}>
        {showSettings ? "hide intervals ▲" : "choose intervals ▼"}
      </button>

      {/* Interval selector grid */}
      {showSettings && (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center",
          marginBottom: 12, maxWidth: 420,
        }}>
          {INTERVALS.map((iv) => {
            const on = enabledIntervals.has(iv.semitones);
            return (
              <button key={iv.semitones} onClick={() => toggleInterval(iv.semitones)}
                style={{
                  background: on ? `${iv.color}22` : "rgba(255,255,255,0.02)",
                  color: on ? iv.color : "#4a4460",
                  border: `1px solid ${on ? `${iv.color}44` : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 12, padding: "4px 10px", fontSize: 10, cursor: "pointer",
                  fontFamily: "'DM Mono',monospace", transition: "all 0.15s",
                  fontWeight: on ? 600 : 400,
                }}>
                {iv.short} {iv.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Big ear icon / visual area */}
      <div style={{
        background: "rgba(255,255,255,0.025)", borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.06)",
        padding: "28px 20px", marginBottom: 6, width: "100%", maxWidth: 470,
        display: "flex", flexDirection: "column", alignItems: "center",
        minHeight: 140, justifyContent: "center",
      }}>
        {!showAnswer ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 8, opacity: 0.6 }}>👂</div>
            <p style={{ color: "#6b6280", fontSize: 12, fontFamily: "'DM Mono',monospace", margin: 0, textAlign: "center" }}>
              Listen to the interval and pick the correct one below
            </p>
            {currentInterval && (
              <p style={{ color: "#4a4460", fontSize: 10, fontFamily: "'DM Mono',monospace", margin: "6px 0 0", opacity: 0.6 }}>
                {currentInterval.direction === "ascending" ? "↑ played ascending" : currentInterval.direction === "descending" ? "↓ played descending" : ""}
              </p>
            )}
          </>
        ) : (
          <>
            <div style={{
              fontSize: 36, fontWeight: 900,
              fontFamily: "'Playfair Display',serif",
              color: wasCorrect ? "#2ecc71" : "#e74c3c",
              marginBottom: 4,
            }}>
              {currentInterval?.interval.name}
            </div>
            <div style={{
              fontSize: 14, color: wasCorrect ? "#2ecc71" : "#e74c3c",
              fontFamily: "'DM Mono',monospace", fontWeight: 600,
            }}>
              {currentInterval?.interval.short} — {currentInterval?.interval.semitones} semitone{currentInterval?.interval.semitones !== 1 ? "s" : ""}
            </div>
            {currentInterval && (
              <div style={{
                fontSize: 11, color: "#6b6280", fontFamily: "'DM Mono',monospace",
                marginTop: 6, opacity: 0.7,
              }}>
                {(() => {
                  const r = currentInterval.root;
                  const t = currentInterval.top;
                  const rDisp = ACCIDENTAL_DISPLAY[r.name]?.displayName || r.name;
                  const tDisp = ACCIDENTAL_DISPLAY[t.name]?.displayName || t.name;
                  return `${rDisp}${r.octave} → ${tDisp}${t.octave}`;
                })()}
              </div>
            )}
          </>
        )}
      </div>

      {/* Replay + feedback */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, height: 36, marginBottom: 2 }}>
        <button onClick={handleReplay}
          style={{
            background: listenPulse ? "rgba(232,168,56,0.25)" : "rgba(232,168,56,0.10)",
            color: "#e8a838",
            border: `1px solid ${listenPulse ? "rgba(232,168,56,0.5)" : "rgba(232,168,56,0.2)"}`,
            borderRadius: 20, padding: "5px 16px", fontSize: 12, fontWeight: 600,
            cursor: "pointer", fontFamily: "'DM Mono',monospace",
            transition: "all 0.15s", transform: listenPulse ? "scale(1.05)" : "scale(1)",
          }}>♪ replay</button>
        <div style={{
          fontSize: 14, fontWeight: 600,
          color: wasCorrect ? "#2ecc71" : "#e74c3c",
          opacity: feedback ? 1 : 0, transition: "opacity 0.15s",
          fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap",
        }}>{feedback}</div>
      </div>

      <Stats correct={correct} total={total} streak={streak} bestStreak={bestStreak} />

      {/* Answer buttons grid */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center",
        width: "100%", maxWidth: 500, marginTop: 4,
      }}>
        {enabledList.map((iv) => {
          const isAnswer = showAnswer && currentInterval?.interval.semitones === iv.semitones;
          return (
            <button key={iv.semitones} onClick={() => handleGuess(iv.semitones)}
              style={{
                background: isAnswer
                  ? (wasCorrect ? "rgba(46,204,113,0.2)" : "rgba(231,76,60,0.2)")
                  : "rgba(255,255,255,0.04)",
                color: isAnswer ? (wasCorrect ? "#2ecc71" : "#e74c3c") : "#c8c0dc",
                border: `1px solid ${isAnswer
                  ? (wasCorrect ? "rgba(46,204,113,0.4)" : "rgba(231,76,60,0.4)")
                  : "rgba(255,255,255,0.08)"}`,
                borderRadius: 12,
                padding: "10px 14px",
                minWidth: 72,
                fontSize: 12, fontWeight: 600, cursor: showAnswer ? "default" : "pointer",
                fontFamily: "'DM Mono',monospace",
                transition: "all 0.15s",
                opacity: showAnswer && !isAnswer ? 0.4 : 1,
              }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{iv.short}</div>
              <div style={{ fontSize: 9, opacity: 0.7, marginTop: 2 }}>{iv.name}</div>
            </button>
          );
        })}
      </div>

      <button onClick={() => { clearTimeout(timerRef.current); newRound(); }}
        style={{
          marginTop: 14, background: "none", border: "1px solid rgba(255,255,255,0.08)",
          color: "#5e567a", borderRadius: 20, padding: "5px 22px",
          fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono',monospace",
        }}>skip →</button>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [mode, setMode] = useState("sight"); // "sight" | "interval"

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0f0c1a 0%, #161230 40%, #0e1a28 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "flex-start", padding: "28px 10px 40px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet" />

      <h1 style={{
        fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 900,
        color: "#faf6f0", letterSpacing: "-0.5px", marginBottom: 2,
      }}>
        {mode === "sight" ? "Sight Reading" : "Interval Training"}
      </h1>
      <p style={{ color: "#5e567a", fontSize: 11, marginTop: 0, marginBottom: 14, letterSpacing: 3 }}>
        {mode === "sight" ? "IDENTIFY THE NOTE" : "TRAIN YOUR EAR"}
      </p>

      {/* Mode switcher */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 16,
        background: "rgba(255,255,255,0.04)",
        borderRadius: 24, padding: 3,
        border: "1px solid rgba(255,255,255,0.06)",
      }}>
        <button onClick={() => setMode("sight")}
          style={{
            background: mode === "sight" ? "rgba(232,168,56,0.15)" : "transparent",
            color: mode === "sight" ? "#e8a838" : "#5e567a",
            border: "none", borderRadius: 20, padding: "6px 18px",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            fontFamily: "'DM Mono',monospace", transition: "all 0.2s",
          }}>🎵 Notes</button>
        <button onClick={() => setMode("interval")}
          style={{
            background: mode === "interval" ? "rgba(200,132,252,0.15)" : "transparent",
            color: mode === "interval" ? "#c084fc" : "#5e567a",
            border: "none", borderRadius: 20, padding: "6px 18px",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            fontFamily: "'DM Mono',monospace", transition: "all 0.2s",
          }}>👂 Intervals</button>
      </div>

      {mode === "sight" ? <SightReadingMode /> : <IntervalMode />}
    </div>
  );
}