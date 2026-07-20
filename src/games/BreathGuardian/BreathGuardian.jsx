import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import AvatarBreathPacer from "../EbbAndFlow/components/AvatarBreathPacer";

import guardianSheet from "./assets/guardian_breath_sheet.webp";
import impA from "./assets/imp_a.png";
import impB from "./assets/imp_b.png";
import vilFA from "./assets/villager_f_a.png";
import vilFB from "./assets/villager_f_b.png";
import vilMA from "./assets/villager_m_a.png";
import vilMB from "./assets/villager_m_b.png";
import pathA from "./assets/pathogen_a.png";
import pathB from "./assets/pathogen_b.png";
import nutA from "./assets/nutrient_a.png";
import nutB from "./assets/nutrient_b.png";
import villageArt from "./assets/village.webp";
import cellFortressArt from "./assets/cell_fortress.webp";
import villageGlowArt from "./assets/village_glow.webp";
import cellFortressGlowArt from "./assets/cell_fortress_glow.webp";

// ============================================================
// BREATH GUARDIAN — Phases 1+2 prototype, two skins
// Phase 1: free breath (30s) — calibration
// Phase 2: guided waves — 2-6s block/receive windows
// Phase 3: your lead — the world times itself to YOUR breath
// Dome up blocks threats, dome open welcomes friends. Additive score.
//
// Ported from the standalone Vite prototype (see resources / HANDOFF). Platform
// integration: local asset imports, `session` prop, Supabase persistence, and a
// Games link out. Avatar wiring lives in AvatarHead / <BreathGuardian>'s avatar
// fetch below.
// ============================================================

const SHEETS = {
  fantasy: { src: guardianSheet, frames: 42, cols: 7, rows: 6, cellW: 360, cellH: 442 },
  // medical hero is procedural SVG (CellHero) — no sheet needed
};

const MOUNTS = {
  fantasy: [[179.5,60.4,30],[179.6,60.5,29],[179.9,59.0,30],[179.8,59.9,30],[179.8,59.7,29],[179.5,60.7,29],[179.4,61.0,29],[179.4,61.0,29],[179.3,61.1,29],[179.2,61.5,29],[179.1,61.2,29],[179.0,61.1,29],[178.9,61.4,28],[178.9,61.6,27],[178.8,61.9,27],[178.7,61.5,26.5],[178.8,61.2,26.2],[178.7,61.0,26],[178.7,61.1,24],[178.6,61.2,24],[178.6,61.1,24],[178.6,61.1,24],[178.6,61.1,24],[178.5,61.0,23.5],[178.5,61.0,23],[178.6,61.2,24],[178.5,61.4,24],[178.5,61.3,24],[178.5,60.9,24],[178.6,60.7,24.0],[178.6,60.6,24.0],[178.6,60.5,24],[178.5,61.0,24],[178.5,61.4,25],[178.5,61.4,24],[178.4,61.6,24],[178.3,62.2,24],[178.3,62.4,24.0],[178.3,62.6,24],[178.2,62.0,24],[178.1,61.7,24],[178.0,61.2,24]],
};

// Per-skin head sizing: head diameter = mount width * scale; dy nudges vertical seat.
const HEAD_FIT = {
  fantasy: { scale: 4.1, dy: -0.52 }, // big cartoon head resting on the neck stump
  medical: { scale: 1.5, dy: 0 },     // head nested in the CellHero nucleus hole
};

// The real platform avatar face (species + hair + eyes, breath-synced) is the
// AvatarBreathPacer rendered as an HTML overlay pinned to an invisible SVG
// marker at the head anchor (`headMarkerRef`). The marker tracks the sprite
// frame / cell swell in screen space, so the face follows the guardian's
// bob and breath automatically. AvatarBreathPacer draws in a fixed AV_BASE-px
// box (viewBox 0 0 200 185, letterboxed): its face head is ~128 wide, centered
// at (100, ~112.5) in that box — the constants below map that onto the marker.
// AV_FIT tunes head size (scale) and pixel nudge (dx/dy) per skin, by eye.
const AV_BASE = 200;
const AV_HEAD_W = 128;     // face head width within the AV_BASE box
const AV_HEAD_CX = 100;    // face head center x
const AV_HEAD_CY = 112.5;  // face head center y (0.5625 * AV_BASE, letterbox-adjusted)
const AV_FIT = {
  fantasy: { scale: 1.18, dx: 0, dy: -2 },
  medical: { scale: 1.06, dx: 0, dy: 0 },
};

const SKINS = {
  fantasy: {
    name: "Village at Dusk",
    tagline: "Shield the village. Welcome the villagers.",
    threatName: "imps", friendName: "villagers",
    skyTop: "#241a38", skyMid: "#4a3260", skyLow: "#7a4e6e",
    ground: "#3a2a4d", groundLight: "#4d3760",
    domeColor: "#9fd8e8", cream: "#f2e6d8", gold: "#e8b86d",
    overlay: "rgba(20,12,34,0.55)", haze: "#7fae52",
    threats: [{ a: impA, b: impB }],
    friends: [{ a: vilFA, b: vilFB }, { a: vilMA, b: vilMB }],
    floaters: false,
  },
  medical: {
    name: "Inside the Body",
    tagline: "Guard the cell. Let the oxygen in.",
    threatName: "pathogens", friendName: "nutrients",
    skyTop: "#4a1f2e", skyMid: "#7c3140", skyLow: "#a84e52",
    ground: "#5e2536", groundLight: "#7c3547",
    domeColor: "#8fe0d8", cream: "#ffe9e2", gold: "#ffc98a",
    overlay: "rgba(52,16,28,0.55)", haze: "#96b53a",
    threats: [{ a: pathA, b: pathB }],
    friends: [{ a: nutA, b: nutB }],
    floaters: true,
  },
};

const FREE_SECONDS = 30;
const WAVE_SECONDS = 75;
const SELF_SECONDS = 60;
const TRAVERSE_S = 3.2;      // breath scrub 0->1 and 1->0
const TRAVEL_S = 3.4;        // entity spawn -> dome edge
// Self-directed ("your lead") is a no-fail energy-breathing phase: inhale draws
// motes of energy into the fortress (charge builds), exhale releases a soft
// mid-scale colour pulse around the safe space. The mote focal is derived from
// the current fortress geometry (see fortRef), so it tracks the art.
const MOTE_SPAWN_STEP = 0.03;   // one inflowing mote per this much inhale progress (lower = denser)
const MOTE_MAX = 70;            // safety cap on concurrent motes
// Each exhale in the light phase emits one soft mid-scale pulse around the
// fortress, cycling through these (non-gold) colours to set it apart from the
// golden shield glow of the block/welcome phases.
const PULSE_DUR_MS = 1700;
const PULSE_COLORS = ["#8fb3ff", "#c79cff", "#8fe0d8", "#ff9ec7", "#a8e063"];
// ── Responsive stage layout ────────────────────────────────────────────────
// The scene is authored along a horizontal ground line: guardian on the left,
// safe-space fortress on the right, threats/friends marching in from off-left
// to a resolve line (dome judged) then a safe point (arrival). All of that
// geometry lives in a per-orientation LAYOUT so the same mechanic fits both a
// wide desktop stage and a narrow phone in portrait — where the landscape
// composition would otherwise crop the guardian and the fortress off-screen.
//
// Only PIXEL GEOMETRY changes between layouts. Timing (TRAVEL_S, TRAVERSE_S,
// phase seconds, spawn plan) is held constant, so portrait and landscape
// sessions stay directly comparable in the research dataset — a phone player
// just sees a shorter (but identically paced) approach track.

// Fortress art is layout-independent; only its placement (x/y/w/h) varies.
const FORTRESS_ART = {
  fantasy: { art: villageArt,      glow: villageGlowArt },
  medical: { art: cellFortressArt, glow: cellFortressGlowArt },
};

const LAYOUTS = {
  landscape: {
    W: 800, H: 500,
    guardianX: 230, groundY: 392,
    resolveX: 442,       // where dome up/down is judged
    safeX: 588,          // detonation / arrival point
    spawnX: -60,         // entities march in from off-stage left
    guardH: 210, entityH: 88,
    fortress: {
      fantasy: { x: 500, y: 239, w: 240, h: 210 },
      medical: { x: 502, y: 177, w: 233, h: 250 },
    },
  },
  // Portrait: narrower/taller viewBox, guardian and fortress pulled together so
  // both — and the full approach runway — stay inside the center-cropped band.
  // Tuned against a ~390×844 phone; key x anchors kept within [40,400] so the
  // side-crop margin never eats the guardian or the fortress.
  portrait: {
    W: 440, H: 780,
    guardianX: 116, groundY: 556,
    resolveX: 205,       // dome judged just left of the fortress
    safeX: 298,          // arrival, inside the fortress
    spawnX: -40,
    guardH: 188, entityH: 82,
    fortress: {
      fantasy: { x: 220, y: 449, w: 170, h: 149 },
      medical: { x: 222, y: 393, w: 176, h: 189 },
    },
  },
};

// Qualitative refuge state — replaces a numeric score, in keeping with the
// no-striving framing. The refuge grows from worried/vulnerable toward
// sheltered/resilient as the player protects and welcomes; the colour ramps
// red -> gold -> blue along the same arc. (The numeric score is still recorded
// in the dataset for research.)
const STATES = {
  fantasy: {
    noun: "village",
    bands: [
      { label: "Worried",   color: "#e2725b" }, // terracotta red
      { label: "Hopeful",   color: "#e8b86d" }, // gold
      { label: "Sheltered", color: "#9fd8e8" }, // dome blue
    ],
  },
  medical: {
    noun: "cell",
    bands: [
      { label: "Vulnerable", color: "#e07a86" }, // red
      { label: "Adapting",   color: "#ffc98a" }, // gold
      { label: "Resilient",  color: "#8fe0d8" }, // teal
    ],
  },
};

function lerpHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const to = (v) => Math.round(v).toString(16).padStart(2, "0");
  return "#" + to(ar + (br - ar) * t) + to(ag + (bg - ag) * t) + to(ab + (bb - ab) * t);
}

// Refuge wellbeing drives the state label/colour. It starts at the MIDDLE
// (Hopeful/Adapting) and moves up with good outcomes (villagers welcomed, imps
// blocked) or down with breaches — so the top and bottom bands are both
// reachable in a session. (The raw additive `score` is kept for research.)
const WELLBEING_START = 50;
const WELLBEING_GOOD = 2.5;  // per villager welcomed / imp blocked
const WELLBEING_BREACH = 9;  // per imp that gets in

// value 0..100 -> { label, color, noun } with a smooth red->gold->blue ramp
function refugeState(skinKey, score) {
  const { bands, noun } = STATES[skinKey];
  const s = Math.max(0, Math.min(100, score));
  const label = s >= 67 ? bands[2].label : s >= 34 ? bands[1].label : bands[0].label;
  const color = s <= 50
    ? lerpHex(bands[0].color, bands[1].color, s / 50)
    : lerpHex(bands[1].color, bands[2].color, (s - 50) / 50);
  return { label, color, noun };
}

// ── Persistence ──────────────────────────────────────────────────────────
// One game_sessions parent row (platform session catalog) + one detail row in
// breath_guardian_sessions carrying flat summary columns for quick querying
// plus the full research `dataset` (trials/events/trace) as JSONB. Fire-and-
// forget from finishSession; failures log but never block the summary screen.
async function saveBreathGuardianSession({ userId, studyId, dataset }) {
  if (!userId) return null;
  const s = dataset.session;
  const { data: gs, error: gsErr } = await supabase
    .from("game_sessions")
    .insert({
      user_id: userId,
      game_name: "breath_guardian",
      study_id: studyId ?? null,
      started_at: s.startedISO,
      ended_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (gsErr) { console.error("saveBreathGuardianSession: game_sessions insert failed", gsErr); return null; }

  const { error: detErr } = await supabase.from("breath_guardian_sessions").insert({
    session_id: gs.id,
    user_id: userId,
    skin: s.skin,
    input_mode: s.inputMode,
    final_score: s.finalScore,
    health: s.health,
    self_phase_cycle_sd: s.selfPhaseCycleSD,
    dataset,
  });
  if (detErr) console.error("saveBreathGuardianSession: detail insert failed", detErr);
  return gs.id;
}

export default function BreathGuardian({ session }) {
  const [skinKey, setSkinKey] = useState("fantasy");
  const skin = SKINS[skinKey];

  // Orientation-responsive stage: a portrait phone gets the pulled-in layout so
  // the guardian and fortress aren't cropped off the sides; everything else
  // (desktop, landscape phone) keeps the original wide composition. Re-evaluated
  // on rotate/resize; the RAF loop reads geometry through layoutRef (below), so
  // a mid-session rotation retunes the stage without restarting the loop.
  const [portrait, setPortrait] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-aspect-ratio: 1/1)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-aspect-ratio: 1/1)");
    const onChange = () => setPortrait(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const layout = portrait ? LAYOUTS.portrait : LAYOUTS.landscape;
  const fortGeom = layout.fortress[skinKey];

  // Avatar config for the logged-in user (procedural face fields; may be null).
  const [avatar, setAvatar] = useState(null);
  const userIdRef = useRef(null);
  userIdRef.current = session?.user?.id ?? null;

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    supabase
      .from("avatars")
      .select("skin_color, eye_color, species, hair_style, hair_color")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setAvatar({
          skinColor: data.skin_color, eyeColor: data.eye_color,
          species: data.species, hairStyle: data.hair_style ?? "none",
          hairColor: data.hair_color ?? "#784421",
        });
      });
  }, [session?.user?.id]);

  // screen: intro | free | bridge | waves | bridge2 | selfdirected | summary
  const [screen, setScreen] = useState("intro");
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(FREE_SECONDS);
  const [stats, setStats] = useState(null);
  const [score, setScore] = useState(0);
  const [helped, setHelped] = useState(0);
  const [blocked, setBlocked] = useState(0);
  const [health, setHealth] = useState(100); // drives grossness only
  const [entities, setEntities] = useState([]);
  const [poofs, setPoofs] = useState([]);

  // Avatar overlay: invisible SVG marker at the head anchor + the HTML pacer
  // element positioned to it each frame.
  const headMarkerRef = useRef(null);
  const avatarOverlayRef = useRef(null);
  // Energy motes render on a <canvas> (not React SVG) to avoid per-frame node
  // churn from constantly spawning/expiring dots.
  const motesCanvasRef = useRef(null);

  const holdRef = useRef(false);
  const progressRef = useRef(0);
  // Animation clock, written by the main RAF loop and read during render for
  // cosmetic wobble/poof timing — reading a ref keeps render pure (no
  // performance.now() call during render, which the purity lint forbids).
  const clockRef = useRef(0);
  const rafRef = useRef(null);
  const lastTsRef = useRef(null);
  const endAtRef = useRef(null);
  const screenRef = useRef("intro");
  screenRef.current = screen;
  // Current fortress geometry, readable inside the RAF loop (for the mote focal).
  const fortRef = useRef(fortGeom);
  fortRef.current = fortGeom;
  // Current stage layout, readable inside the RAF loop (spawn/travel geometry).
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const inhaleStartRef = useRef(null);
  const exhaleStartRef = useRef(null);
  const inhalesRef = useRef([]);
  const exhalesRef = useRef([]);
  const traceRef = useRef([]);
  const lastSampleRef = useRef(0);
  const [traceTick, setTraceTick] = useState(0);

  const entitiesRef = useRef([]);
  const spawnPlanRef = useRef([]);
  const phaseStartRef = useRef(0);
  const scoreRef = useRef(0);
  const healthRef = useRef(100);
  const idRef = useRef(1);
  const traceMarksRef = useRef({ waves: 0, self: 0 });
  // Self-directed energy phase (read during render; mutated in the RAF loop):
  const chargeRef = useRef(0);      // gathered energy 0..1 (builds on inhale)
  const radianceRef = useRef(0);    // outward shine 0..~1.5 (spikes on exhale, decays)
  const motesRef = useRef([]);      // inflowing energy particles
  const pulsesRef = useRef([]);     // soft colour pulses around the fortress (per exhale)
  const pulseIdxRef = useRef(0);    // color-cycle counter
  const prevSelfPRef = useRef(0);   // last progress, for inhale/exhale delta
  const moteAccumRef = useRef(0);   // fractional mote-spawn accumulator
  // ---- research data capture ----
  const trialsRef = useRef([]);          // one per entity: attention/accuracy measures
  const eventsRef = useRef([]);          // raw press/release log
  const phaseLogRef = useRef([]);        // phase name + start time
  const inputModeRef = useRef(null);     // "touch" | "key" (first used)
  const sessionT0Ref = useRef(0);

  // ---------- session control ----------
  const resetBreathLog = () => {
    holdRef.current = false;
    progressRef.current = 0;
    inhalesRef.current = [];
    exhalesRef.current = [];
    traceRef.current = [];
    inhaleStartRef.current = null;
    exhaleStartRef.current = null;
    setProgress(0);
  };

  const beginSession = () => {
    resetBreathLog();
    setScore(0); scoreRef.current = 0;
    setHealth(100); healthRef.current = 100;
    setHelped(0); setBlocked(0);
    setEntities([]); entitiesRef.current = [];
    setPoofs([]);
    traceMarksRef.current = { waves: 0, self: 0 };
    chargeRef.current = 0; radianceRef.current = 0; motesRef.current = []; pulsesRef.current = []; moteAccumRef.current = 0; prevSelfPRef.current = 0;
    trialsRef.current = [];
    eventsRef.current = [];
    inputModeRef.current = null;
    sessionT0Ref.current = performance.now();
    phaseLogRef.current = [{ phase: "free", t: 0 }];
    endAtRef.current = performance.now() + FREE_SECONDS * 1000;
    setTimeLeft(FREE_SECONDS);
    setScreen("free");
  };

  const naturalCycle = () => {
    const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
    const c = avg(inhalesRef.current) + avg(exhalesRef.current);
    return Math.min(10, Math.max(4, c || 6));
  };

  const startWaves = useCallback(() => {
    naturalCycle(); // measured rate kept for future pacing modes
    const now = performance.now();
    phaseStartRef.current = now + 3000; // bridge banner
    // spawn plan: threats arrive mid-inhale half, friends mid-exhale half
    // alternating block/receive windows, each 2-6s (safe breathing range),
    // one entity per window arriving after the transition has had time to land
    const plan = [];
    let t = 1.0;
    let kind = "threat";
    while (t < WAVE_SECONDS - 4) {
      const dur = 2 + Math.random() * 4; // 2-6s window
      const arrival = t + Math.max(1.4, dur * 0.55);
      plan.push({ t: arrival - TRAVEL_S, kind });
      t += dur;
      kind = kind === "threat" ? "friend" : "threat";
    }
    spawnPlanRef.current = plan.filter((p) => p.t > 0.5).sort((a, b) => a.t - b.t);
    traceMarksRef.current.waves = traceRef.current.length;
    phaseLogRef.current.push({ phase: "waves", t: (phaseStartRef.current - sessionT0Ref.current) / 1000 });
    endAtRef.current = phaseStartRef.current + WAVE_SECONDS * 1000;
    setTimeLeft(WAVE_SECONDS);
    setScreen("bridge");
    setTimeout(() => {
      if (screenRef.current === "bridge") setScreen("waves");
    }, 3000);
  }, []);

  const startSelf = useCallback(() => {
    const now = performance.now();
    phaseStartRef.current = now + 3000;
    spawnPlanRef.current = [];
    // Clear any lingering waves entities and reset the energy field for a clean
    // start to the light phase.
    entitiesRef.current = []; setEntities([]);
    chargeRef.current = 0; radianceRef.current = 0; motesRef.current = []; pulsesRef.current = [];
    moteAccumRef.current = 0; prevSelfPRef.current = progressRef.current;
    traceMarksRef.current.self = traceRef.current.length;
    phaseLogRef.current.push({ phase: "selfdirected", t: (phaseStartRef.current - sessionT0Ref.current) / 1000 });
    endAtRef.current = phaseStartRef.current + SELF_SECONDS * 1000;
    setTimeLeft(SELF_SECONDS);
    setScreen("bridge2");
    setTimeout(() => {
      if (screenRef.current === "bridge2") setScreen("selfdirected");
    }, 3000);
  }, []);

  const finishSession = useCallback(() => {
    const now = performance.now();
    if (holdRef.current && inhaleStartRef.current != null)
      inhalesRef.current.push((now - inhaleStartRef.current) / 1000);
    else if (!holdRef.current && exhaleStartRef.current != null)
      exhalesRef.current.push((now - exhaleStartRef.current) / 1000);
    const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
    const avgIn = avg(inhalesRef.current);
    const avgOut = avg(exhalesRef.current);
    // breath cycle SD in self-directed phase (self-regulation proxy)
    const selfStart = phaseLogRef.current.find((p) => p.phase === "selfdirected")?.t ?? Infinity;
    const presses = eventsRef.current.filter((ev) => ev.type === "press" && ev.t >= selfStart).map((ev) => ev.t);
    const cyc = presses.slice(1).map((t, i) => t - presses[i]);
    const cycMean = cyc.length ? cyc.reduce((a, b) => a + b, 0) / cyc.length : 0;
    const cycSD = cyc.length > 1 ? Math.sqrt(cyc.reduce((a, b) => a + (b - cycMean) ** 2, 0) / (cyc.length - 1)) : null;

    // Final refuge wellbeing (the state shown to the player) — from trial outcomes.
    const outc = (o) => trialsRef.current.filter((t) => t.outcome === o).length;
    const finalWellbeing = Math.max(0, Math.min(100,
      WELLBEING_START + (outc("blocked") + outc("entered")) * WELLBEING_GOOD - outc("breach") * WELLBEING_BREACH));

    const dataset = {
      session: {
        app: "breath-guardian",
        version: "0.6",
        startedISO: new Date(Date.now() - (performance.now() - sessionT0Ref.current)).toISOString(),
        skin: skinKey,
        inputMode: inputModeRef.current,
        // Stage orientation + viewport, so portrait (phone) and landscape sessions
        // can be segmented or comparability-checked. Timing is identical across
        // layouts (only pixel geometry differs), so the two are poolable.
        layout: layoutRef.current === LAYOUTS.portrait ? "portrait" : "landscape",
        viewport: typeof window !== "undefined" ? { w: window.innerWidth, h: window.innerHeight } : null,
        phases: phaseLogRef.current,
        finalScore: scoreRef.current,
        finalWellbeing,
        health: healthRef.current,
        selfPhaseCycleSD: cycSD,
      },
      trials: trialsRef.current.map((t) => ({
        ...t,
        timeOnTarget: t.total > 0 ? Math.round((t.onTarget / t.total) * 1000) / 1000 : null,
        latency: t.latency === null ? null : Math.round(t.latency * 1000) / 1000,
      })),
      events: eventsRef.current,
      trace: { sampleMs: 80, marks: traceMarksRef.current, values: traceRef.current.map((v) => Math.round(v * 100) / 100) },
    };

    // Persist to Supabase (no-op for logged-out/dev). Fire-and-forget: the
    // summary screen renders immediately regardless of the write outcome.
    saveBreathGuardianSession({ userId: userIdRef.current, studyId: null, dataset });

    setStats({
      cycles: Math.min(inhalesRef.current.length, exhalesRef.current.length),
      avgIn, avgOut,
      bpm: avgIn + avgOut > 0 ? 60 / (avgIn + avgOut) : 0,
      trace: [...traceRef.current],
      dataset,
    });
    const cv = motesCanvasRef.current;   // don't leave motes drawn under the summary
    if (cv) cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
    setScreen("summary");
  }, [skinKey]);

  // ---------- main loop ----------
  useEffect(() => {
    if (!["free", "waves", "bridge", "bridge2", "selfdirected"].includes(screen)) return;
    const loop = (ts) => {
      // Paused while the tab is hidden (see the visibilitychange effect, which
      // also shifts the phase deadlines forward so no session time is lost).
      // Skip all updates but keep the RAF alive; reset lastTs so the first
      // visible frame doesn't apply a huge dt.
      if (document.hidden) {
        lastTsRef.current = null;
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.1);
      lastTsRef.current = ts;
      clockRef.current = ts;

      // breath scrub
      const rate = holdRef.current ? dt / TRAVERSE_S : -dt / TRAVERSE_S;
      progressRef.current = Math.max(0, Math.min(1, progressRef.current + rate));
      setProgress(progressRef.current);

      if (ts - lastSampleRef.current > 80) {
        lastSampleRef.current = ts;
        traceRef.current.push(progressRef.current);
        if (traceRef.current.length % 5 === 0) setTraceTick((t) => t + 1);
      }

      // waves: spawn + move + resolve (block/welcome mechanic)
      if (screen === "waves") {
        const L = layoutRef.current;
        const tPhase = (ts - phaseStartRef.current) / 1000;
        const plan = spawnPlanRef.current;
        while (plan.length && plan[0].t <= tPhase) {
          const p = plan.shift();
          const pool = p.kind === "threat" ? skin.threats : skin.friends;
          const art = pool[Math.floor(Math.random() * pool.length)];
          const eid = idRef.current++;
          entitiesRef.current.push({
            id: eid, kind: p.kind, art,
            x: L.spawnX, dir: 1, mode: "approach",
            y: skin.floaters ? L.groundY - 60 - Math.random() * 90 : L.groundY,
            bobSeed: Math.random() * Math.PI * 2, born: ts, resolvedAt: 0,
          });
          {
            const correctNow = p.kind === "threat" ? holdRef.current : !holdRef.current;
            const prev = trialsRef.current[trialsRef.current.length - 1];
            trialsRef.current.push({
              id: eid, kind: p.kind,
              phase: "waves",
              spawnT: (ts - sessionT0Ref.current) / 1000,
              prePositioned: correctNow,
              latency: correctNow ? 0 : null,
              switchTrial: prev ? prev.kind !== p.kind : null,
              onTarget: 0, total: 0,
              pAtArrival: null, outcome: null, scoreAfter: null,
            });
          }
        }
        const speed = (L.resolveX - L.spawnX) / TRAVEL_S;
        const list = entitiesRef.current;
        // accumulate attention measures for the CLOSEST approaching entity (the active trial)
        {
          const approaching = list.filter((e) => e.mode === "approach");
          if (approaching.length) {
            const closest = approaching.reduce((a, b) => (a.x > b.x ? a : b));
            const tr = trialsRef.current.find((t) => t.id === closest.id);
            if (tr) {
              const correct = tr.kind === "threat" ? holdRef.current : !holdRef.current;
              tr.total += dt;
              if (correct) {
                tr.onTarget += dt;
                if (tr.latency === null) tr.latency = (ts - sessionT0Ref.current) / 1000 - tr.spawnT;
              }
            }
          }
        }
        for (const e of list) {
          if (e.mode === "approach") {
            e.x += speed * dt;
            if (e.x >= L.resolveX) {
              const pNow = progressRef.current;
              const tr = trialsRef.current.find((t) => t.id === e.id);
              if (tr) tr.pAtArrival = Math.round(pNow * 1000) / 1000;
              if (e.kind === "threat") {
                if (pNow >= 0.4) {
                  e.mode = "bounce"; e.dir = -1; e.resolvedAt = ts;
                  scoreRef.current = Math.min(100, scoreRef.current + 3);
                  setScore(scoreRef.current);
                  setBlocked((b) => b + 1);
                  if (tr) { tr.outcome = "blocked"; tr.scoreAfter = scoreRef.current; }
                } else { e.mode = "breach"; if (tr) tr.outcome = "breach"; }
              } else {
                if (pNow <= 0.6) { e.mode = "enter"; if (tr) tr.outcome = "entered"; }
                else {
                  e.mode = "turned"; e.dir = -1; e.resolvedAt = ts;
                  if (tr) { tr.outcome = "turned"; tr.scoreAfter = scoreRef.current; }
                }
              }
            }
          } else if (e.mode === "breach" || e.mode === "enter") {
            e.x += speed * 0.85 * dt;
            if (e.x >= L.safeX) {
              if (e.mode === "breach") {
                healthRef.current = Math.max(0, healthRef.current - 10);
                setHealth(healthRef.current);
                scoreRef.current = Math.max(0, scoreRef.current - 8);
                setScore(scoreRef.current);
                { const tr2 = trialsRef.current.find((t) => t.id === e.id); if (tr2) tr2.scoreAfter = scoreRef.current; }
                setPoofs((ps) => [...ps.slice(-6), { id: e.id, x: L.safeX, y: e.y - 40, t0: ts }]);
              } else {
                scoreRef.current = Math.min(100, scoreRef.current + 5);
                setScore(scoreRef.current);
                { const tr2 = trialsRef.current.find((t) => t.id === e.id); if (tr2) tr2.scoreAfter = scoreRef.current; }
                setHelped((h) => h + 1);
                setPoofs((ps) => [...ps.slice(-6), { id: e.id, x: L.safeX, y: e.y - 46, t0: ts, good: true }]);
              }
              e.mode = "gone";
            }
          } else if (e.mode === "bounce" || e.mode === "turned") {
            e.x -= speed * 0.8 * dt;
          }
        }
        entitiesRef.current = list.filter((e) => e.mode !== "gone" && e.x > -90);
        setEntities([...entitiesRef.current]);
        setPoofs((ps) => ps.filter((p) => ts - p.t0 < 600));
      }

      // self-directed: breath drives an energy field (no entities, no score).
      // Inhaling (progress rising) gathers charge and pulls in motes; exhaling
      // (progress falling) spends charge into outward radiance that decays back
      // to calm. Values are read directly during render (setProgress above
      // already re-renders every frame).
      if (screen === "selfdirected") {
        const f = fortRef.current;               // motes gather to the fortress
        const fx = f.x + f.w / 2, fy = f.y + f.h * 0.42;
        const dP = progressRef.current - prevSelfPRef.current;
        prevSelfPRef.current = progressRef.current;
        if (dP > 0) {
          chargeRef.current = Math.min(1, chargeRef.current + dP * 0.9);
          moteAccumRef.current += dP;
          while (moteAccumRef.current >= MOTE_SPAWN_STEP && motesRef.current.length < MOTE_MAX) {
            moteAccumRef.current -= MOTE_SPAWN_STEP;
            const ang = Math.random() * Math.PI * 2;
            const dist = 360 + Math.random() * 180;
            motesRef.current.push({
              id: idRef.current++,
              sx: fx + Math.cos(ang) * dist,
              sy: fy + Math.sin(ang) * dist * 0.72,
              t: 0,
              dur: 1.1 + Math.random() * 0.8,
            });
          }
        } else if (dP < 0) {
          const released = -dP;
          radianceRef.current = Math.min(1.5, radianceRef.current + released * (0.4 + chargeRef.current));
          chargeRef.current = Math.max(0, chargeRef.current + dP * 0.8); // deplete as it flows out
        }
        radianceRef.current *= 0.955; // ease back toward calm
        for (const m of motesRef.current) m.t += dt / m.dur;
        motesRef.current = motesRef.current.filter((m) => m.t < 1);
        pulsesRef.current = pulsesRef.current.filter((pl) => ts - pl.born < PULSE_DUR_MS);
      }

      // draw energy motes on the canvas (light phase); clear it otherwise. Maps
      // the current layout's viewBox (L.W × L.H) onto the backing store at
      // xMidYMax-slice scale, matching the stage <svg> so the dots line up with
      // the fortress in both orientations.
      {
        const cv = motesCanvasRef.current;
        if (cv) {
          const ctx = cv.getContext("2d");
          const cw = cv.width, ch = cv.height;
          ctx.clearRect(0, 0, cw, ch);
          if (screen === "selfdirected" && motesRef.current.length) {
            const L = layoutRef.current;       // match the stage viewBox + slice
            const sc = Math.max(cw / L.W, ch / L.H);
            const ox = (cw - L.W * sc) / 2;    // xMid
            const oy = ch - L.H * sc;          // yMax (bottom-aligned)
            const f = fortRef.current;
            const fx = f.x + f.w / 2, fy = f.y + f.h * 0.42;
            ctx.fillStyle = skin.gold;
            for (const m of motesRef.current) {
              const e = m.t * m.t;             // accelerate toward the focal point
              const mx = m.sx + (fx - m.sx) * e;
              const my = m.sy + (fy - m.sy) * e;
              ctx.globalAlpha = Math.sin(Math.min(1, m.t) * Math.PI) * 0.9;
              ctx.beginPath();
              ctx.arc(ox + mx * sc, oy + my * sc, (2 + 1.8 * (1 - m.t)) * sc, 0, 6.2832);
              ctx.fill();
            }
            ctx.globalAlpha = 1;
          }
        }
      }

      // timer
      if (screen !== "bridge") {
        const msLeft = endAtRef.current - ts;
        const secLeft = Math.max(0, Math.ceil(msLeft / 1000));
        setTimeLeft((prev) => (prev !== secLeft ? secLeft : prev));
        if (msLeft <= 0) {
          if (screen === "free") startWaves();
          else if (screen === "waves") startSelf();
          else { finishSession(); return; }
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    lastTsRef.current = null;
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen, skin, startWaves, startSelf, finishSession]);

  // Pause on tab-hide: while hidden the RAF loop stops advancing (above), and
  // when the tab returns we shift every pending performance.now() deadline/marker
  // forward by however long it was hidden — so a backgrounded tab never silently
  // loses phase time, leaves a half-over phase, or records a giant inhale spanning
  // the gap. (The trace simply has no samples for the hidden interval, which is
  // correct: the participant wasn't breathing or looking.)
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) {
        hiddenAt = performance.now();
      } else if (hiddenAt) {
        const gap = performance.now() - hiddenAt;
        for (const ref of [endAtRef, phaseStartRef, inhaleStartRef, exhaleStartRef]) {
          if (ref.current != null) ref.current += gap;
        }
        lastTsRef.current = null;
        hiddenAt = 0;
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Size the motes canvas backing store to the viewport (× DPR for crispness).
  useEffect(() => {
    const cv = motesCanvasRef.current;
    if (!cv) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(window.innerWidth * dpr);
      cv.height = Math.round(window.innerHeight * dpr);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ---------- input ----------
  const startHold = useCallback(() => {
    if (holdRef.current) return;
    holdRef.current = true;
    const now = performance.now();
    inhaleStartRef.current = now;
    eventsRef.current.push({ t: (now - sessionT0Ref.current) / 1000, type: "press" });
    if (exhaleStartRef.current != null) {
      exhalesRef.current.push((now - exhaleStartRef.current) / 1000);
      exhaleStartRef.current = null;
    }
  }, []);
  const endHold = useCallback(() => {
    if (!holdRef.current) return;
    holdRef.current = false;
    const now = performance.now();
    exhaleStartRef.current = now;
    eventsRef.current.push({ t: (now - sessionT0Ref.current) / 1000, type: "release" });
    if (inhaleStartRef.current != null) {
      inhalesRef.current.push((now - inhaleStartRef.current) / 1000);
      inhaleStartRef.current = null;
    }
    // Light phase: releasing the gathered energy sends a soft mid-scale pulse
    // around the fortress, in the next colour of the cycle.
    if (screenRef.current === "selfdirected" && chargeRef.current > 0.12) {
      pulsesRef.current.push({ id: idRef.current++, born: now, charge: chargeRef.current, ci: pulseIdxRef.current % PULSE_COLORS.length });
      pulseIdxRef.current++;
    }
  }, []);

  useEffect(() => {
    if (!["free", "waves", "bridge", "bridge2", "selfdirected"].includes(screen)) return;
    const down = (e) => { if (e.code === "Space" && !e.repeat) { e.preventDefault(); if (!inputModeRef.current) inputModeRef.current = "key"; startHold(); } };
    const up = (e) => { if (e.code === "Space") { e.preventDefault(); endHold(); } };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [screen, startHold, endHold]);

  // ---------- avatar overlay position sync ----------
  // Pin the HTML AvatarBreathPacer onto the invisible head marker every frame.
  // getBoundingClientRect gives live screen coords, so this tracks the SVG's
  // slice-scaling, the per-frame neck bob, and the cell's breath swell for free.
  // Show whenever an avatar is loaded — including intro/summary, where the
  // overlay sits behind those screens' backdrop blur in paint order, so the
  // guardian keeps its head there instead of going bare.
  const showAvatar = !!avatar;
  useEffect(() => {
    if (!showAvatar) return;
    let raf;
    const sync = () => {
      const marker = headMarkerRef.current;
      const el = avatarOverlayRef.current;
      if (marker && el) {
        const r = marker.getBoundingClientRect();
        if (r.width > 0) {
          const fit = AV_FIT[skinKey] ?? AV_FIT.fantasy;
          const k = (r.width * fit.scale) / AV_HEAD_W; // scale of the AV_BASE box
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          el.style.transform = `scale(${k})`;
          el.style.left = `${cx - AV_HEAD_CX * k + fit.dx}px`;
          el.style.top = `${cy - AV_HEAD_CY * k + fit.dy}px`;
          el.style.opacity = "1";
        }
      }
      raf = requestAnimationFrame(sync);
    };
    raf = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(raf);
  }, [showAvatar, skinKey]);

  // ---------- derived visuals ----------
  const p = progress;
  const ease = p * p * (3 - 2 * p);
  // Fortress shield-glow — the block/welcome affordance in the free & guided
  // phases (brightens on the inhale = shield up). NOT shown in the light phase,
  // which has its own language (dots gather in on the inhale, a colour pulse
  // breathes out on the exhale) — so on the in-breath there you just see the
  // energy flow in, no aura. The glow is a PRE-BAKED image (no runtime SVG filter) with
  // opacity quantized to discrete stages so it only changes a few times/breath.
  const auraGlow = screen === "selfdirected" ? 0 : ease;
  const auraStage = Math.round(auraGlow * auraGlow * 3) / 3; // wide discrete stages: 0, .33, .67, 1
  // "Things aren't going well" cue: the scene darkens inward as breaches mount
  // (health falls). Shape-agnostic, so it can't misalign with the art. Reaches
  // full gloom by ~health 45 (≈4 breaches) so a couple of imps is clearly felt.
  const damage = Math.min(1, (100 - health) / 55);
  const fort = { ...FORTRESS_ART[skinKey], ...fortGeom };
  // Stage viewBox + a horizontal scale for the backdrop decoration coords, which
  // are authored in the 800-wide landscape space and spread across the current
  // stage width (kx === 1 in landscape, so that layout renders identically).
  const { W: vbW, H: vbH, groundY: gy } = layout;
  const kx = vbW / 800;
  const inPlay = ["free", "waves", "bridge", "bridge2", "selfdirected"].includes(screen);
  const fmt = (s) => `${s.toFixed(1)}s`;
  // Wellbeing: start at the middle, rise with good outcomes, fall with breaches.
  const breaches = Math.round((100 - health) / 10);
  const wellbeing = WELLBEING_START + (helped + blocked) * WELLBEING_GOOD - breaches * WELLBEING_BREACH;
  const refuge = refugeState(skinKey, wellbeing);

  return (
    <div
      style={{
        position: "fixed", inset: 0, overflow: "hidden",
        background: skin.skyTop, color: skin.cream,
        fontFamily: "ui-rounded, 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', 'Segoe UI', system-ui, sans-serif",
        userSelect: "none", WebkitUserSelect: "none", touchAction: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <style>{`
        @keyframes twinkle { 0%,100%{opacity:.35} 50%{opacity:.9} }
        .bg-star { animation: twinkle 3.4s ease-in-out infinite; }
        @keyframes drift { 0%{transform:translateY(0)} 50%{transform:translateY(-14px)} 100%{transform:translateY(0)} }
        .bg-drift { animation: drift 7s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .bg-star { animation: none; opacity:.5 }
          .bg-drift { animation: none }
        }
        .hud-eyebrow { letter-spacing:.22em; font-size:11px; text-transform:uppercase; opacity:.75; }
        .big-btn { background:${skin.cream}; color:${skin.skyTop}; border:none; font:inherit;
          font-weight:700; font-size:17px; padding:14px 34px; border-radius:999px; cursor:pointer; }
        .big-btn:focus-visible { outline:3px solid ${skin.gold}; outline-offset:3px; }
        .skin-btn { font:inherit; font-size:14px; font-weight:600; padding:10px 18px; border-radius:14px;
          cursor:pointer; border:2px solid ${skin.cream}55; background:transparent; color:${skin.cream}; }
        .skin-btn.active { border-color:${skin.gold}; background:${skin.gold}22; }
        .bg-exit { position:absolute; top:16px; left:22px; z-index:5; font:inherit; font-size:13px;
          font-weight:600; letter-spacing:.04em; color:${skin.cream}; text-decoration:none; opacity:.72;
          padding:6px 12px; border-radius:999px; border:1px solid ${skin.cream}40; background:${skin.overlay}; }
        .bg-exit:hover { opacity:1; }
      `}</style>

      {/* ===== STAGE ===== */}
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="xMidYMax slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        onPointerDown={(e) => { if (inPlay) { if (!inputModeRef.current) inputModeRef.current = "touch"; e.currentTarget.setPointerCapture(e.pointerId); startHold(); } }}
        onPointerUp={() => inPlay && endHold()}
        onPointerCancel={() => inPlay && endHold()}
      >
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={skin.skyTop} />
            <stop offset="55%" stopColor={skin.skyMid} />
            <stop offset="100%" stopColor={skin.skyLow} />
          </linearGradient>
          <radialGradient id="cellAmbient" cx="50%" cy="40%" r="75%">
            <stop offset="0%" stopColor={skin.skyLow} />
            <stop offset="100%" stopColor={skin.skyTop} />
          </radialGradient>
          {/* "things aren't going well" — gloom creeping inward from the edges */}
          <radialGradient id="damageVignette" cx="50%" cy="50%" r="72%">
            <stop offset="25%" stopColor="#0a0206" stopOpacity="0" />
            <stop offset="100%" stopColor="#0a0206" stopOpacity="0.92" />
          </radialGradient>
          {/* light-phase exhale pulses — one soft radial glow per palette colour */}
          {PULSE_COLORS.map((c, i) => (
            <radialGradient key={i} id={`pulse${i}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={c} stopOpacity="0.8" />
              <stop offset="55%" stopColor={c} stopOpacity="0.32" />
              <stop offset="100%" stopColor={c} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>

        {/* ---------- BACKDROP ---------- */}
        {skinKey === "fantasy" ? (
          <>
            <rect width={vbW} height={vbH} fill="url(#sky)" />
            {[[90,60],[180,110],[300,45],[420,90],[560,55],[660,120],[730,70],[240,160],[500,150],[640,40]].map(([x,y],i)=>(
              <circle key={i} className="bg-star" cx={x*kx} cy={y} r={i%3===0?2:1.3} fill={skin.cream}
                style={{ animationDelay: `${(i*0.7)%3}s` }} />
            ))}
            <path d={`M0,${gy-62} Q${vbW*0.25},${gy-122} ${vbW*0.52},${gy-72} T${vbW},${gy-92} V${vbH} H0 Z`} fill="#2e2246" />
            <rect y={gy-12} width={vbW} height={vbH-gy+12} fill={skin.ground} />
            <ellipse cx={vbW/2} cy={gy-8} rx={vbW*0.54} ry={26} fill={skin.groundLight} opacity="0.5" />
            {/* safe-space village; silhouette aura kindles with the breath (and
                blazes with the accumulated radiance in the light phase) */}
            <FortressImage href={fort.art} glowHref={fort.glow} x={fort.x} y={fort.y} w={fort.w} h={fort.h} glow={auraStage} />
          </>
        ) : (
          <>
            <rect width={vbW} height={vbH} fill="url(#cellAmbient)" />
            {[[110,90,60],[640,70,80],[730,260,46],[70,300,52],[360,60,40],[520,330,64]].map(([x,y,r],i)=>(
              <circle key={i} className="bg-drift" cx={x*kx} cy={y} r={r} fill={skin.skyLow} opacity="0.35"
                style={{ animationDelay: `${(i*1.3)%7}s` }} />
            ))}
            {[[200,140],[300,220],[460,120],[600,180],[170,250],[700,120],[420,300]].map(([x,y],i)=>(
              <circle key={`s${i}`} className="bg-star" cx={x*kx} cy={y} r={2} fill={skin.cream} opacity="0.5"
                style={{ animationDelay: `${(i*0.9)%3}s` }} />
            ))}
            <path d={`M0,${gy} Q${vbW*0.25},${gy-16} ${vbW*0.5},${gy-2} T${vbW},${gy-4} V${vbH} H0 Z`} fill={skin.ground} />
            <path d={`M0,${gy} Q${vbW*0.25},${gy-16} ${vbW*0.5},${gy-2} T${vbW},${gy-4}`} fill="none" stroke={skin.groundLight} strokeWidth="6" opacity="0.6" />
            {/* safe-space cell fortress; silhouette aura kindles with the breath
                (and blazes with the accumulated radiance in the light phase) */}
            <FortressImage href={fort.art} glowHref={fort.glow} x={fort.x} y={fort.y} w={fort.w} h={fort.h} glow={auraStage} />
          </>
        )}

        {/* ---------- ENERGY FIELD, front layer (self-directed) ---------- */}
        {/* On the inhale, motes gather in (no aura). On the exhale, a soft
            mid-scale colour pulse breathes out around the fortress. */}
        {screen === "selfdirected" && (
            <g style={{ pointerEvents: "none" }}>
              {/* exhale pulses: soft radial colour glow, gently swelling + fading */}
              {pulsesRef.current.map((pl) => {
                const age = (clockRef.current - pl.born) / PULSE_DUR_MS;
                if (age >= 1) return null;
                const s = 0.9 + age * 0.4;                                  // gentle mid-scale swell
                const op = Math.sin(age * Math.PI) * 0.6 * Math.min(1, pl.charge + 0.4); // fade in then out
                const cx = fort.x + fort.w / 2, cy = fort.y + fort.h * 0.5;
                const R = Math.max(fort.w, fort.h) * 0.72 * s;
                return (
                  <ellipse key={pl.id} cx={cx} cy={cy} rx={R} ry={R * 0.82}
                    fill={`url(#pulse${pl.ci})`} opacity={op} />
                );
              })}
              {/* (inflowing motes render on the canvas overlay, not here) */}
            </g>
        )}

        {/* ---------- HERO ---------- */}
        {/* Drawn BEFORE the entities so the imps/villagers (and pathogens/
            nutrients) march in FRONT of the guardian's body, not behind it.
            (The avatar face is a separate HTML overlay that still paints on top,
            but it sits high/centred, clear of the ground-level sprites.) */}
        {skinKey === "fantasy" ? (() => {
          const sheet = SHEETS.fantasy;
          const frame = Math.round(p * (sheet.frames - 1));
          const col = frame % sheet.cols;
          const row = Math.floor(frame / sheet.cols);
          const dispH = layout.guardH;
          const dispW = (sheet.cellW / sheet.cellH) * dispH;
          const sc = dispW / sheet.cellW;
          const [mx, my] = MOUNTS.fantasy[frame];
          const fit = HEAD_FIT.fantasy;
          const headD = 27 * sc * fit.scale * (1 + 0.16 * ease); // fixed base; visible swell with breath
          const hx = mx * sc;
          const hy = my * sc + headD * fit.dy;
          return (
            <g transform={`translate(${layout.guardianX - dispW / 2}, ${layout.groundY - dispH})`}>
              <clipPath id="guardClip"><rect width={dispW} height={dispH} /></clipPath>
              <g clipPath="url(#guardClip)">
                <image href={sheet.src} x={-col * dispW} y={-row * dispH}
                  width={sheet.cols * dispW} height={sheet.rows * dispH} />
              </g>
              <AvatarHead x={hx} y={hy} d={headD} avatar={avatar} markerRef={headMarkerRef} />
            </g>
          );
        })() : (
          <CellHero ease={ease} cx={layout.guardianX} groundY={layout.groundY} fit={HEAD_FIT.medical} avatar={avatar} markerRef={headMarkerRef} now={clockRef.current} />
        )}

        {/* ---------- ENTITIES (in front of the guardian) ---------- */}
        {entities.map((e) => {
          const img =
            e.mode === "bounce" ? e.art.b        // threat recoils (B pose), mirrored to face left
            : e.mode === "enter" ? e.art.b       // friend celebrates arrival
            : e.art.a;                            // approach; turned-away friends reuse A flipped
          // Rejected entities (threat bounced, friend turned) walk back left, so
          // mirror them horizontally to face their retreat direction.
          const flip = e.mode === "turned" || e.mode === "bounce";
          const wobble = skin.floaters ? Math.sin(clockRef.current / 480 + e.bobSeed) * 6 : 0;
          const entH = layout.entityH;
          const hW = entH * 0.72;
          return (
            <image
              key={e.id} href={img}
              x={e.x - hW / 2} y={e.y - entH + wobble}
              width={hW} height={entH}
              transform={flip ? `scale(-1,1) translate(${-2 * e.x},0)` : undefined}
              style={{ opacity: e.mode === "bounce" || e.mode === "turned" ? 0.9 : 1 }}
            />
          );
        })}

        {/* poofs */}
        {poofs.map((pf) => {
          const age = Math.min(1, (clockRef.current - pf.t0) / 600);
          return (
            <circle key={pf.id} cx={pf.x} cy={pf.y} r={10 + age * 34}
              fill="none" stroke={pf.good ? skin.gold : skin.haze}
              strokeWidth={4 * (1 - age)} opacity={1 - age} />
          );
        })}

        {/* ---------- "things aren't going well": edge vignette on breaches ---------- */}
        {damage > 0.01 && (
          <rect width={vbW} height={vbH} fill="url(#damageVignette)" opacity={damage}
            style={{ transition: "opacity 800ms ease", pointerEvents: "none" }} />
        )}
      </svg>

      {/* energy motes — drawn imperatively on a canvas (light phase only), out of
          React to avoid per-frame node churn. Overlays the stage at matching
          xMidYMax-slice scaling (see the draw code in the main loop). */}
      <canvas ref={motesCanvasRef}
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />

      {/* real platform avatar face, pinned to the head marker (see sync effect).
          position:fixed + transformOrigin 0 0; the sync effect sets left/top/
          scale. pointerEvents none so breath-hold pointer capture still works.
          Rendered before the UI below so it paints under the HUD / exit link. */}
      {showAvatar && (
        <div
          ref={avatarOverlayRef}
          style={{
            position: "fixed", left: 0, top: 0, opacity: 0,
            transformOrigin: "0 0", pointerEvents: "none",
          }}
        >
          {/* scaleAmplitude 0: head size already swells via the marker.
              getLevel: breath-sync, 0 exhale → 1 inhale. */}
          <AvatarBreathPacer
            skinColor={avatar.skinColor}
            eyeColor={avatar.eyeColor}
            species={avatar.species}
            hairStyle={avatar.hairStyle}
            hairColor={avatar.hairColor}
            scaleAmplitude={0}
            getLevel={() => progressRef.current}
            size={AV_BASE}
          />
        </div>
      )}

      {/* exit to games library — always available */}
      <Link to="/games" className="bg-exit">← Games</Link>

      {/* ===== HUD ===== */}
      {inPlay && (
        <>
          <div style={{ position: "absolute", top: 18, left: 96 }}>
            <div className="hud-eyebrow">Breath Guardian</div>
            <div style={{ fontSize: 14, opacity: 0.9, marginTop: 3 }}>
              {screen === "free" ? "Free breath" : screen === "selfdirected" || screen === "bridge2" ? "Your lead" : "Guided waves"} · {skin.name}
            </div>
          </div>
          <div style={{ position: "absolute", top: 18, right: 22, textAlign: "right" }}>
            <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 26, fontWeight: 700 }} aria-live="polite">
              {timeLeft}
            </div>
            {screen !== "free" && (
              <div style={{ fontSize: 12, marginTop: 3 }}>
                <span style={{ opacity: 0.65, textTransform: "capitalize" }}>The {refuge.noun} is </span>
                <b style={{ color: refuge.color, textShadow: "0 1px 6px rgba(0,0,0,.55)" }}>{refuge.label}</b>
              </div>
            )}
          </div>
          <div style={{ position: "absolute", bottom: 74, width: "100%", textAlign: "center",
            fontSize: 15, opacity: 0.85, pointerEvents: "none" }}>
            Hold while you breathe in · Release as you breathe out
          </div>
          <svg viewBox="0 0 800 44" preserveAspectRatio="none" data-tick={traceTick}
            style={{ position: "absolute", bottom: 14, left: "4%", width: "92%", height: 44, opacity: 0.9 }}>
            <polyline fill="none" stroke={skin.domeColor} strokeWidth="2" strokeLinejoin="round"
              points={traceRef.current.slice(-260)
                .map((v, i, arr) => `${(i / Math.max(arr.length - 1, 1)) * 800},${40 - v * 36}`).join(" ")} />
          </svg>
        </>
      )}

      {/* ===== BRIDGE BANNER ===== */}
      {screen === "bridge" && (
        <div style={{ position: "absolute", top: "34%", width: "100%", textAlign: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 28, fontWeight: 800, textShadow: "0 2px 12px rgba(0,0,0,.5)" }}>
            Here they come
          </div>
          <div style={{ fontSize: 16, opacity: 0.9, marginTop: 6 }}>
            Shield up for {skin.threatName} · open for {skin.friendName}
          </div>
        </div>
      )}

      {/* ===== BRIDGE 2 BANNER ===== */}
      {screen === "bridge2" && (
        <div style={{ position: "absolute", top: "34%", width: "100%", textAlign: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 28, fontWeight: 800, textShadow: "0 2px 12px rgba(0,0,0,.5)" }}>
            Now just breathe
          </div>
          <div style={{ fontSize: 16, opacity: 0.9, marginTop: 6 }}>
            Breathe in to draw the light in · breathe out to let it shine from {skinKey === "medical" ? "the cell" : "the village"}.
          </div>
        </div>
      )}

      {/* ===== INTRO ===== */}
      {screen === "intro" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 18, background: skin.overlay,
          backdropFilter: "blur(3px)", textAlign: "center", padding: 24 }}>
          <div className="hud-eyebrow">Breath Guardian</div>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800 }}>One breath at a time</h1>
          <div style={{ display: "flex", gap: 10 }}>
            {Object.entries(SKINS).map(([key, s]) => (
              <button key={key} className={`skin-btn${key === skinKey ? " active" : ""}`}
                onClick={() => setSkinKey(key)}>{s.name}</button>
            ))}
          </div>
          <div style={{ fontSize: 14, opacity: 0.8, marginTop: -6 }}>{skin.tagline}</div>
          <p style={{ maxWidth: 440, lineHeight: 1.55, fontSize: 16, opacity: 0.92, margin: 0 }}>
            Hold anywhere (or the space bar) while you breathe in, release as you
            breathe out. A short free breath comes first. Then the world joins in,
            and by the end, it moves to whatever rhythm you choose.
          </p>
          <button className="big-btn" onClick={() => setScreen("howto")}>How to play →</button>
        </div>
      )}

      {/* ===== HOW TO PLAY (teach card) ===== */}
      {screen === "howto" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16, background: skin.overlay,
          backdropFilter: "blur(3px)", textAlign: "center", padding: 24 }}>
          <div className="hud-eyebrow">How to play · {skin.name}</div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>Shield, then welcome</h1>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
            {/* threat: breathe in to shield */}
            <div style={{ width: 220, padding: "18px 16px", borderRadius: 16,
              border: `2px solid ${skin.domeColor}55`, background: `${skin.domeColor}12`,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <img src={skin.threats[0].a} alt={skin.threatName}
                style={{ height: 88, objectFit: "contain", filter: "drop-shadow(0 4px 8px rgba(0,0,0,.4))" }} />
              <div style={{ fontSize: 17, fontWeight: 800, textTransform: "capitalize" }}>{skin.threatName}</div>
              <div style={{ fontSize: 13.5, opacity: 0.9, lineHeight: 1.5 }}>
                <b>Breathe in</b> — hold to raise the shield and keep them out.
              </div>
            </div>
            {/* friend: breathe out to welcome */}
            <div style={{ width: 220, padding: "18px 16px", borderRadius: 16,
              border: `2px solid ${skin.gold}55`, background: `${skin.gold}12`,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <img src={skin.friends[0].a} alt={skin.friendName}
                style={{ height: 88, objectFit: "contain", filter: "drop-shadow(0 4px 8px rgba(0,0,0,.4))" }} />
              <div style={{ fontSize: 17, fontWeight: 800, textTransform: "capitalize" }}>{skin.friendName}</div>
              <div style={{ fontSize: 13.5, opacity: 0.9, lineHeight: 1.5 }}>
                <b>Breathe out</b> — release to open the shield and welcome them in.
              </div>
            </div>
          </div>
          <p style={{ maxWidth: 430, lineHeight: 1.55, fontSize: 15, opacity: 0.9, margin: 0 }}>
            Hold anywhere (or the space bar) as you breathe in; release as you breathe
            out. Nothing to chase — every breath both protects and welcomes.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            <button className="big-btn" onClick={beginSession}>Begin</button>
            <button className="skin-btn" onClick={() => setScreen("intro")} style={{ fontSize: 15 }}>
              ← Change world
            </button>
          </div>
        </div>
      )}

      {/* ===== SUMMARY ===== */}
      {screen === "summary" && stats && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 14, background: skin.overlay,
          backdropFilter: "blur(3px)", textAlign: "center", padding: 24 }}>
          <div className="hud-eyebrow">Session complete</div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: refuge.color }}>
            Your {refuge.noun} is {refuge.label.toLowerCase()}
          </h1>
          <div style={{ display: "flex", gap: 26, marginTop: 6, flexWrap: "wrap", justifyContent: "center" }}>
            <Stat label={`${skin.friendName} helped`} value={`${helped}`} />
            <Stat label={`${skin.threatName} turned away`} value={`${blocked}`} />
            <Stat label="Breath cycles" value={`${stats.cycles}`} />
            <Stat label="Breaths / min" value={stats.bpm.toFixed(1)} />
          </div>
          <svg viewBox="0 0 480 66" preserveAspectRatio="none"
            style={{ width: "min(480px, 86%)", height: 66, marginTop: 8 }}>
            {(() => {
              const n = Math.max(stats.trace.length - 1, 1);
              const mk = traceMarksRef.current;
              const xw = (i) => (i / n) * 480;
              return (
                <>
                  <rect x={xw(mk.waves)} y="0" width={xw(mk.self) - xw(mk.waves)} height="56"
                    fill={skin.gold} opacity="0.08" />
                  <rect x={xw(mk.self)} y="0" width={480 - xw(mk.self)} height="56"
                    fill={skin.domeColor} opacity="0.08" />
                  <polyline fill="none" stroke={skin.domeColor} strokeWidth="2"
                    points={stats.trace.map((v, i) => `${xw(i)},${50 - v * 44}`).join(" ")} />
                  <text x={xw(mk.waves) / 2} y="64" textAnchor="middle" fontSize="9"
                    fill={skin.cream} opacity="0.7">free</text>
                  <text x={(xw(mk.waves) + xw(mk.self)) / 2} y="64" textAnchor="middle" fontSize="9"
                    fill={skin.cream} opacity="0.7">guided</text>
                  <text x={(xw(mk.self) + 480) / 2} y="64" textAnchor="middle" fontSize="9"
                    fill={skin.cream} opacity="0.7">your lead</text>
                </>
              );
            })()}
          </svg>
          <p style={{ maxWidth: 420, fontSize: 14, opacity: 0.8, margin: 0, lineHeight: 1.5 }}>
            Every breath did two things at once: held a boundary, then let the good in.
            Nothing to chase — by the end, the world was moving at your pace.
            Avg inhale {fmt(stats.avgIn)} · avg exhale {fmt(stats.avgOut)}.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap", justifyContent: "center" }}>
            <button className="big-btn" onClick={beginSession}>Play again</button>
            <Link to="/games" className="skin-btn" style={{ fontSize: 15, textDecoration: "none" }}>
              Games →
            </Link>
            <button className="skin-btn" onClick={() => setScreen("intro")} style={{ fontSize: 15 }}>
              Change world
            </button>
            {import.meta.env.DEV && (
              <button className="skin-btn" style={{ fontSize: 15 }}
                onClick={() => {
                  const blob = new Blob([JSON.stringify(stats.dataset, null, 2)], { type: "application/json" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `breath-guardian-${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                }}>
                Download data
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AvatarHead({ x, y, d, avatar, markerRef }) {
  // When an avatar is loaded, the real face is drawn by the HTML overlay
  // (AvatarBreathPacer) pinned to this invisible marker — the marker is the
  // only thing rendered here in SVG space. Without an avatar (logged-out / dev),
  // fall back to the tinted placeholder face tinted with any partial config.
  const skinFill = avatar?.skinColor ?? "#f4c99b";
  const eyeFill = avatar?.eyeColor ?? "#3a2a2a";
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* screen-space anchor the overlay tracks (invisible, non-interactive) */}
      <circle ref={markerRef} r={d / 2} fill="none" style={{ pointerEvents: "none" }} />
      {!avatar && (
        <g>
          <circle r={d / 2} fill={skinFill} />
          <circle cx={-d * 0.16} cy={-d * 0.06} r={d * 0.05} fill={eyeFill} />
          <circle cx={d * 0.16} cy={-d * 0.06} r={d * 0.05} fill={eyeFill} />
          <path d={`M ${-d * 0.13},${d * 0.14} Q 0,${d * 0.26} ${d * 0.13},${d * 0.14}`}
            fill="none" stroke="#3a2a2a" strokeWidth={d * 0.03} strokeLinecap="round" />
          <circle r={d / 2} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth={d * 0.03} />
        </g>
      )}
    </g>
  );
}

function CellHero({ ease, cx, groundY, fit, avatar, markerRef, now = 0 }) {
  // procedural white blood cell: swells 0.62x -> 1.12x with breath
  const t = now / 1000;
  const s = 0.62 + 0.5 * ease;
  const R = 72;
  const bumps = [0, 48, 95, 142, 190, 232, 275, 318].map((deg, i) => {
    const a = (deg * Math.PI) / 180;
    const wob = Math.sin(t * 1.4 + i * 1.7) * 2.5 + Math.sin(t * 0.6 + i) * 1.5;
    const rad = R * 0.96 + wob + ease * 6;
    const br = R * (0.2 + 0.06 * Math.sin(i * 2.3)) * (0.9 + 0.35 * ease);
    return { x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.92, r: br };
  });
  const holeR = R * 0.34 * (0.85 + 0.35 * ease);
  const holeY = 0; // nucleus hole + avatar centered in the cell (was -R*0.18)
  const headD = holeR * 2 * fit.scale;
  return (
    <g transform={`translate(${cx}, ${groundY - 8 - R * s}) scale(${s})`}>
      <defs>
        <radialGradient id="cellBody" cx="42%" cy="34%" r="80%">
          <stop offset="0%" stopColor="#f6fbf9" />
          <stop offset="62%" stopColor="#e2f1ec" />
          <stop offset="100%" stopColor="#c4e0d8" />
        </radialGradient>
        <radialGradient id="cellHole" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#35625e" />
          <stop offset="80%" stopColor="#4d8a84" />
          <stop offset="100%" stopColor="#63a49b" />
        </radialGradient>
      </defs>
      {bumps.map((b, i) => (
        <circle key={i} cx={b.x} cy={b.y} r={b.r} fill="url(#cellBody)"
          stroke="#b2d8cf" strokeWidth="2" />
      ))}
      <ellipse rx={R} ry={R * 0.95} fill="url(#cellBody)" stroke="#b2d8cf" strokeWidth="3" />
      {/* soft inner shading + gloss */}
      <ellipse cx={R * 0.18} cy={R * 0.34} rx={R * 0.72} ry={R * 0.5} fill="#bcded5" opacity="0.35" />
      <ellipse cx={-R * 0.3} cy={-R * 0.42} rx={R * 0.34} ry={R * 0.18} fill="#ffffff" opacity="0.75"
        transform={`rotate(-24 ${-R * 0.3} ${-R * 0.42})`} />
      {/* nucleus hole with avatar head nested */}
      <circle cx={0} cy={holeY} r={holeR * 1.14} fill="#9cc7bf" opacity="0.6" />
      <circle cx={0} cy={holeY} r={holeR} fill="url(#cellHole)" />
      <AvatarHead x={0} y={holeY + headD * fit.dy} d={headD} avatar={avatar} markerRef={markerRef} />
    </g>
  );
}

// Fortress artwork with an optional glowing silhouette aura. The aura is a
// pre-baked gold glow image (`glowHref`) that hugs the building outline; it
// fades in behind the real fortress with the breath (`glow` 0..1, quantized to
// discrete stages by the caller).
function FortressImage({ href, glowHref, x, y, w, h, glow = 0 }) {
  // The aura is a pre-baked gold glow image (padded 6% each side; see the PIL
  // bake step) behind the fortress. Each discrete stage steps up BOTH its
  // opacity AND its scale, so the aura visibly reaches further out as it builds.
  // Anchored at the base (bottom-centre) so it radiates up-and-out without
  // bleeding into the ground. Scaling a plain image (no filter) + quantized
  // stage = cheap: the transform only changes at stage boundaries.
  const px = w * 0.06, py = h * 0.06;
  const s = 1 + glow * 0.25;           // up to 1.25× extent at full glow
  const cx = x + w / 2, by = y + h;    // base pivot
  return (
    <>
      {glow > 0.02 && (
        <image href={glowHref} x={x - px} y={y - py} width={w + 2 * px} height={h + 2 * py}
          opacity={Math.min(1, glow)}
          transform={`translate(${cx} ${by}) scale(${s}) translate(${-cx} ${-by})`}
          style={{ pointerEvents: "none" }} />
      )}
      <image href={href} x={x} y={y} width={w} height={h} />
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ minWidth: 96 }}>
      <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", opacity: 0.7 }}>{label}</div>
    </div>
  );
}
