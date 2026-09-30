import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// MakerHeat palette — straight from app/globals.css, no fake chrome.
const C = {
  paper: "#111009",
  panel: "#191712",
  ink: "#e8e4dc",
  dim: "#9a917e",
  faint: "#6b6355",
  line: "#2c2820",
  accent: "#d8a24a",
  sell: "#d4664a",
  buy: "#5a9e6f",
};
const FONT_DATA = "ui-monospace, 'Cascadia Mono', Consolas, monospace";
const FONT_DECO = "Georgia, 'Times New Roman', serif";

const fade = (f: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(f, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const Scene: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const frame = useCurrentFrame();
  const o = fade(frame, from, from + 12) * (frame > to - 12 ? fade(frame, to - 12, to, 1, 0) : 1);
  if (frame < from || frame > to) return null;
  return <AbsoluteFill style={{ opacity: o, padding: "72px 96px" }}>{children}</AbsoluteFill>;
};

const Tag: React.FC<{ text: string }> = ({ text }) => (
  <div style={{
    fontFamily: FONT_DATA, fontSize: 15, letterSpacing: "0.3em", textTransform: "uppercase",
    color: C.faint, marginBottom: 40, borderLeft: `3px solid ${C.accent}`, paddingLeft: 16,
  }}>{text}</div>
);

const Stamp: React.FC<{ text: string; frame: number; fps: number; delay: number; color?: string }> =
  ({ text, frame, fps, delay, color = C.accent }) => {
    const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 160 } });
    return (
      <div style={{
        display: "inline-block", fontFamily: FONT_DATA, fontWeight: 700, fontSize: 26,
        letterSpacing: "0.14em", textTransform: "uppercase", color,
        border: `3px solid ${color}`, borderRadius: 6, padding: "10px 22px",
        transform: `rotate(-1.6deg) scale(${interpolate(s, [0, 1], [1.4, 1])})`,
        opacity: s,
      }}>{text}</div>
    );
  };

// Contract address bar — the app's scanner row, reproduced.
const QueryBar: React.FC<{ frame: number; delay: number }> = ({ frame, delay }) => {
  const full = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
  const n = Math.floor(fade(frame, delay, delay + 40) * full.length);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 18, fontFamily: FONT_DATA,
      background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "18px 24px",
      opacity: fade(frame, delay - 6, delay),
    }}>
      <span style={{ color: C.faint, fontSize: 17, textTransform: "uppercase", letterSpacing: "0.15em" }}>solana</span>
      <span style={{ color: C.ink, fontSize: 20 }}>{full.slice(0, n)}<span style={{ color: C.accent }}>▌</span></span>
      <span style={{ marginLeft: "auto", color: C.paper, background: C.accent, borderRadius: 5, padding: "8px 18px", fontWeight: 700, fontSize: 15, letterSpacing: "0.1em", textTransform: "uppercase" }}>scan</span>
    </div>
  );
};

// Big number that can strike-through to a revised value.
const MetricCell: React.FC<{ label: string; value: string; sub: string; tone?: string; struck?: boolean; newValue?: string; frame: number; flipAt?: number }> =
  ({ label, value, sub, tone = C.accent, struck, newValue, frame, flipAt = 0 }) => (
    <div style={{
      flex: 1, border: `1px solid ${C.line}`, borderRadius: 10, padding: "26px 30px",
      background: C.panel, position: "relative",
    }}>
      <div style={{ fontFamily: FONT_DATA, fontSize: 14, color: C.faint, textTransform: "uppercase", letterSpacing: "0.18em" }}>{label}</div>
      <div style={{ marginTop: 12, position: "relative", display: "inline-block" }}>
        <span style={{
          fontFamily: FONT_DECO, fontSize: 64, color: tone,
          textDecoration: struck ? "line-through" : "none",
          textDecorationColor: C.sell, textDecorationThickness: 5,
        }}>{value}</span>
        {newValue && frame >= flipAt && (
          <span style={{
            fontFamily: FONT_DECO, fontSize: 64, color: C.buy, marginLeft: 24,
            opacity: fade(frame, flipAt, flipAt + 14),
          }}>{newValue}</span>
        )}
      </div>
      <div style={{ fontFamily: FONT_DATA, fontSize: 14, color: C.dim, marginTop: 10 }}>{sub}</div>
    </div>
  );

// Depth curve — the product's signature picture, drawn by the frame counter.
const DepthCurve: React.FC<{ frame: number; startAt: number; points: { ev: number; top3: number; noBuy: number }[]; colorTop: string; colorNoBuy: string }> =
  ({ frame, startAt, points, colorTop, colorNoBuy }) => {
    const W = 1500, H = 380, P = 60;
    const t = fade(frame, startAt, startAt + 90);
    const maxEv = points[points.length - 1]!.ev;
    const x = (ev: number) => P + (ev / maxEv) * (W - 2 * P);
    const y = (v: number) => H - P - v * (H - 2 * P);
    const draw = (get: (p: { top3: number; noBuy: number }) => number) => {
      const vis = Math.max(2, Math.ceil(points.length * t));
      return points.slice(0, vis).map((p) => `${x(p.ev).toFixed(1)},${y(get(p))}`).join(" ");
    };
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }}>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line x1={P} x2={W - P} y1={y(g)} y2={y(g)} stroke={C.line} strokeWidth={1} />
            <text x={8} y={y(g) + 6} fontSize={15} fill={C.faint} fontFamily={FONT_DATA}>{Math.round(g * 100)}%</text>
          </g>
        ))}
        <polyline points={draw((p) => p.top3)} fill="none" stroke={colorTop} strokeWidth={4} strokeLinejoin="round" />
        <polyline points={draw((p) => p.noBuy)} fill="none" stroke={colorNoBuy} strokeWidth={3.4} strokeDasharray="10 7" />
        {points.slice(0, Math.ceil(points.length * t)).map((p, i) => (
          <circle key={i} cx={x(p.ev)} cy={y(p.top3)} r={6} fill={colorTop} />
        ))}
        {/* page-boundary ticks */}
        {points.map((p, i) => (
          <text key={i} x={x(p.ev)} y={H - 14} fontSize={13} fill={C.faint} fontFamily={FONT_DATA} textAnchor="middle">{p.ev}</text>
        ))}
      </svg>
    );
  };

// VO timing (30fps) — re-probed from real audio durations.
// voPrefix picks the voice set: "vo-" = Deepgram Aura, "vo-mf-" = edge-tts
// two-voice (male s0-s2 / female s3-s5), "vo-el-" = ElevenLabs (if generated).
const voTrack = (prefix: string) => [
  { file: `${prefix}s0.mp3`, from: 10 },
  { file: `${prefix}s1.mp3`, from: 250 },
  { file: `${prefix}s2.mp3`, from: 700 },
  { file: `${prefix}s3.mp3`, from: 1000 },
  { file: `${prefix}s4.mp3`, from: 1660 },
  { file: `${prefix}s5.mp3`, from: 2160 },
];

export const MakerHeatDemo: React.FC<{ voPrefix?: string }> = ({ voPrefix = "vo-" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flipAt = 1180;

  // Real fixture curve — group `jup-solana-now`, same endTime, 10 pages.
  // Replayable verbatim: POST /api/scan {replay:"jup-solana-now"}.
  const curve = [
    { ev: 100, top3: 0.528, noBuy: 0.947 },
    { ev: 200, top3: 0.420, noBuy: 0.706 },
    { ev: 300, top3: 0.420, noBuy: 0.572 },
    { ev: 400, top3: 0.398, noBuy: 0.446 },
    { ev: 500, top3: 0.353, noBuy: 0.319 },
    { ev: 600, top3: 0.340, noBuy: 0.313 },
    { ev: 700, top3: 0.313, noBuy: 0.317 },
    { ev: 800, top3: 0.327, noBuy: 0.303 },
    { ev: 900, top3: 0.316, noBuy: 0.261 },
    { ev: 1000, top3: 0.327, noBuy: 0.241 },
  ];

  return (
    <AbsoluteFill style={{ background: C.paper, color: C.ink, fontFamily: FONT_DATA }}>
      {voTrack(voPrefix).map((v) => (
        <Sequence key={v.file} from={v.from}>
          <Audio src={staticFile(v.file)} />
        </Sequence>
      ))}

      {/* S0 — Title (0–230) */}
      <Scene from={0} to={230}>
        <div style={{ marginTop: 210, textAlign: "center" }}>
          <div style={{ fontFamily: FONT_DATA, fontSize: 19, letterSpacing: "0.4em", color: C.faint, textTransform: "uppercase", opacity: fade(frame, 8, 30) }}>
            CoinMarketCap DEX tape
          </div>
          <div style={{ fontFamily: FONT_DECO, fontSize: 108, marginTop: 26, opacity: fade(frame, 18, 42), fontStyle: "italic" }}>
            Maker<span style={{ color: C.accent, fontStyle: "normal" }}>Heat</span>
          </div>
          <div style={{ fontFamily: FONT_DATA, fontSize: 27, color: C.dim, marginTop: 30, opacity: fade(frame, 40, 66) }}>
            who supplied the volume — and how deep does the sample go?
          </div>
        </div>
      </Scene>

      {/* S1 — The naive answer (240–660) */}
      <Scene from={240} to={660}>
        <Tag text="Jupiter · Solana · live tape" />
        <QueryBar frame={frame} delay={280} />
        <div style={{ opacity: fade(frame, 300, 340), marginTop: 44 }}>
          <div style={{ fontFamily: FONT_DATA, fontSize: 16, color: C.faint, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 22 }}>
            last 100 observed swap events · span 3.8 minutes
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <MetricCell label="top-3 sellers" value="52.8%" sub="of attributed sell USD" frame={frame} />
            <MetricCell label="no buy observed" value="94.7%" sub="of sell USD — sellers never seen buying" tone={C.sell} frame={frame} />
            <MetricCell label="dominant ∧ no-buy" value="52.8%" sub="top-3 sellers with zero buys" tone={C.sell} frame={frame} />
          </div>
          <Stamp text="looks like a supply wall" frame={frame} fps={fps} delay={580} color={C.sell} />
        </div>
      </Scene>

      {/* S2 — The doubt (690–960) */}
      <Scene from={690} to={960}>
        <div style={{ marginTop: 240, textAlign: "center" }}>
          <div style={{ fontFamily: FONT_DECO, fontSize: 58, lineHeight: 1.2 }}>
            Except — that was <span style={{ color: C.accent }}>100 events</span>.
          </div>
          <div style={{ fontFamily: FONT_DECO, fontSize: 58, marginTop: 22, color: C.dim }}>
            Four minutes of tape.
          </div>
          <div style={{
            fontFamily: FONT_DATA, fontSize: 21, color: C.sell, marginTop: 56,
            opacity: fade(frame, 840, 880), letterSpacing: "0.06em",
          }}>
            is that a signal — or just the window?
          </div>
        </div>
      </Scene>

      {/* S3 — The flip (990–1620) */}
      <Scene from={990} to={1620}>
        <Tag text="same token · same endTime · one more page" />
        <div style={{ display: "flex", gap: 24, opacity: fade(frame, 1030, 1060) }}>
          <MetricCell label="top-3 sellers" value="52.8%" newValue="32.7%" struck={frame >= flipAt} frame={frame} flipAt={flipAt} sub="1,000 events now" />
          <MetricCell label="no buy observed" value="94.7%" newValue="24.1%" struck={frame >= flipAt} frame={frame} flipAt={flipAt + 12} sub="the 'ghost supply' mostly bought" tone={C.sell} />
          <MetricCell label="dominant ∧ no-buy" value="52.8%" newValue="0.0%" struck={frame >= flipAt} frame={frame} flipAt={flipAt + 24} sub="gone by event 300" tone={C.sell} />
        </div>
        <div style={{ marginTop: 50, opacity: fade(frame, 1330, 1370) }}>
          <DepthCurve frame={frame} startAt={1330} points={curve} colorTop={C.accent} colorNoBuy={C.sell} />
        </div>
      </Scene>

      {/* S4 — What it means (1650–2120) */}
      <Scene from={1650} to={2120}>
        <Tag text="the number is the sample" />
        <div style={{ fontFamily: FONT_DECO, fontSize: 50, lineHeight: 1.25, maxWidth: 1400 }}>
          Concentration you can <span style={{ color: C.accent }}>watch converge</span>
          <span style={{ color: C.dim }}> — or watch swing.</span>
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 60 }}>
          {[
            { k: "every page boundary", v: "top-N share recomputed at 100, 200, 300… events" },
            { k: "seller context", v: "no-buy-observed share — presence, not just positive USD" },
            { k: "receipts", v: "sha256 per response · replayable to the byte" },
          ].map((it, i) => (
            <div key={i} style={{
              flex: 1, border: `1px solid ${C.line}`, borderRadius: 10, padding: "24px 28px",
              background: C.panel, opacity: fade(frame, 1720 + i * 80, 1760 + i * 80),
            }}>
              <div style={{ fontFamily: FONT_DATA, fontSize: 15, color: C.accent, textTransform: "uppercase", letterSpacing: "0.16em" }}>{it.k}</div>
              <div style={{ fontFamily: FONT_DATA, fontSize: 17, color: C.dim, marginTop: 14, lineHeight: 1.5 }}>{it.v}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 46, opacity: fade(frame, 1980, 2020) }}>
          <Stamp text="descriptive · sample-bounded · never a verdict" frame={frame} fps={fps} delay={1980} />
        </div>
      </Scene>

      {/* S5 — Close (2150–2520) */}
      <Scene from={2150} to={2520}>
        <div style={{ marginTop: 250, textAlign: "center" }}>
          <div style={{ fontFamily: FONT_DECO, fontSize: 72, fontStyle: "italic" }}>
            Maker<span style={{ color: C.accent, fontStyle: "normal" }}>Heat</span>
          </div>
          <div style={{ fontFamily: FONT_DATA, fontSize: 23, color: C.dim, marginTop: 34, opacity: fade(frame, 2220, 2250) }}>
            evidence depth, not vibes
          </div>
          <div style={{ fontFamily: FONT_DATA, fontSize: 16, color: C.faint, marginTop: 60, opacity: fade(frame, 2300, 2340), lineHeight: 1.9 }}>
            github.com/alfindigital/makerheat<br />
            replays run from committed fixtures — zero API credits
          </div>
        </div>
      </Scene>
    </AbsoluteFill>
  );
};
