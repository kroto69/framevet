import React from 'react';
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame } from 'remotion';

const e = React.createElement;

const BG = '#f8fafc';
const INK = '#0f172a';
const MUTED = '#64748b';
const ACCENT = '#2563eb';
const GREEN = '#16a34a';
const RED = '#dc2626';
const CARD = '#ffffff';
const BORDER = '#e2e8f0';
const DARK = '#0f172a';

const DOT_BG = {
  backgroundColor: BG,
  backgroundImage: 'radial-gradient(circle, #dbe3ee 1.5px, transparent 1.5px)',
  backgroundSize: '36px 36px',
};

function fadeAt(from, span = 16) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [from, from + span], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return { opacity: p, transform: `translateY(${interpolate(p, [0, 1], [24, 0])}px)` };
}

function Pill({ text, color, from = 0 }) {
  const f = fadeAt(from);
  return e(
    'div',
    {
      style: {
        display: 'inline-block',
        backgroundColor: color,
        color: '#fff',
        fontSize: 22,
        fontWeight: 800,
        letterSpacing: 2,
        borderRadius: 999,
        padding: '8px 22px',
        ...f,
      },
    },
    text,
  );
}

function Header({ pill, pillColor, title, sub, from = 0 }) {
  const f = fadeAt(from);
  return e(
    'div',
    { style: { position: 'absolute', top: 64, left: 90, right: 90, ...f } },
    e(Pill, { text: pill, color: pillColor, from: 0 }),
    e('div', { style: { fontSize: 58, fontWeight: 800, color: INK, marginTop: 18 } }, title),
    sub ? e('div', { style: { fontSize: 28, color: MUTED, marginTop: 12 } }, sub) : null,
  );
}

function Card({ fadeFrom, accent = ACCENT, width = 400, children, style = {} }) {
  const f = fadeAt(fadeFrom);
  return e(
    'div',
    {
      style: {
        width,
        boxSizing: 'border-box',
        backgroundColor: CARD,
        border: `1px solid ${BORDER}`,
        borderTop: `6px solid ${accent}`,
        borderRadius: 20,
        padding: '24px 28px',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
        opacity: f.opacity,
        transform: f.transform,
        ...style,
      },
    },
    children,
  );
}

function Mono({ children, size = 25, color = '#e2e8f0' }) {
  return e(
    'div',
    { style: { fontFamily: 'monospace', fontSize: size, color, lineHeight: 1.55, fontWeight: 600 } },
    children,
  );
}

function Arrow({ from }) {
  const f = fadeAt(from);
  return e(
    'div',
    {
      style: {
        alignSelf: 'center',
        fontSize: 34,
        fontWeight: 800,
        color: MUTED,
        padding: '0 6px',
        opacity: f.opacity,
      },
    },
    '->',
  );
}

function Chip({ label, from, color = ACCENT, danger = false }) {
  const f = fadeAt(from);
  return e(
    'div',
    {
      style: {
        backgroundColor: danger ? '#fef2f2' : '#eff6ff',
        border: `2px solid ${danger ? RED : color}`,
        color: danger ? RED : INK,
        borderRadius: 14,
        padding: '14px 22px',
        fontSize: 26,
        fontWeight: 700,
        opacity: f.opacity,
        transform: f.transform,
        whiteSpace: 'nowrap',
      },
    },
    label,
  );
}

function SceneTanpa() {
  const frame = useCurrentFrame();
  const barP = interpolate(frame, [250, 1100], [0.05, 0.97], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const barGlow = interpolate(frame, [1050, 1180], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return e(
    AbsoluteFill,
    { style: { ...DOT_BG, fontFamily: 'sans-serif', color: INK, overflow: 'hidden' } },
    e(Header, {
      pill: 'WITHOUT FRAMEVET',
      pillColor: RED,
      title: 'Agents can write code, but cannot see the render',
      sub: 'the only way to check the result: wait for the expensive full render',
      from: 0,
    }),
    e(
      'div',
      {
        style: {
          position: 'absolute',
          top: 330,
          left: 90,
          right: 90,
          display: 'flex',
          alignItems: 'center',
        },
      },
      e(Chip, { label: 'edit code', from: 60 }),
      e(Arrow, { from: 120 }),
      e(Chip, { label: 'full render, ~4 min', from: 180, color: MUTED }),
      e(Arrow, { from: 240 }),
      e(Chip, { label: 'bug found too late', from: 300, danger: true }),
    ),
    e(
      'div',
      { style: { position: 'absolute', top: 560, left: 90, right: 90, ...fadeAt(380, 24) } },
      e(
        Card,
        { fadeFrom: 0, accent: MUTED, width: '100%' },
        e(Mono, { size: 26, color: MUTED }, '$ npx remotion render src/index.js PromoVideo'),
        e(
          'div',
          { style: { height: 30, borderRadius: 15, backgroundColor: '#e2e8f0', marginTop: 18, overflow: 'hidden' } },
          e('div', {
            style: {
              height: '100%',
              width: `${barP * 100}%`,
              backgroundColor: barGlow > 0.5 ? RED : ACCENT,
            },
          }),
        ),
        e(
          'div',
          { style: { fontSize: 24, color: barGlow > 0.5 ? RED : MUTED, marginTop: 14, fontWeight: 700, opacity: barGlow } },
          'after 4 minutes: frame 150 turns out broken',
        ),
      ),
    ),
  );
}

const STEPS = [
  ['1', 'framevet.config.json', 'frames + expectations'],
  ['2', 'browser ensure', 'fast preflight'],
  ['3', 'remotion still --frame=N', 'just 2-4 frames'],
  ['4', 'gallery index.html', 'frames + labels'],
  ['5', 'serve 127.0.0.1:<port>', 'local page'],
  ['6', 'kane-cli run --agent --url', 'Kane opens the page'],
  ['7', 'OBSERVATION per frame', 'PASS/FAIL per frame'],
  ['8', 'verdict', 'PASS only if all PASS'],
];

function StepCard({ n, label, sub, from }) {
  const f = fadeAt(from);
  return e(
    'div',
    { style: { display: 'flex', alignItems: 'center', opacity: f.opacity, transform: f.transform } },
    e(
      'div',
      {
        style: {
          width: 52,
          height: 52,
          borderRadius: 16,
          backgroundColor: ACCENT,
          color: '#fff',
          fontSize: 28,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 16,
          flexShrink: 0,
        },
      },
      n,
    ),
    e(
      'div',
      null,
      e('div', { style: { fontFamily: 'monospace', fontSize: 24, fontWeight: 700, color: INK } }, label),
      e('div', { style: { fontSize: 21, color: MUTED, marginTop: 4 } }, sub),
    ),
  );
}

function SceneDengan() {
  const rows = [
    STEPS.slice(0, 4).map((s, i) => ({ s, i })),
    STEPS.slice(4).map((s, i) => ({ s, i: i + 4 })),
  ];
  return e(
    AbsoluteFill,
    { style: { ...DOT_BG, fontFamily: 'sans-serif', color: INK, overflow: 'hidden' } },
    e(Header, {
      pill: 'WITH FRAMEVET',
      pillColor: ACCENT,
      title: 'Check first, render once',
      sub: 'a few key frames, judged by Kane in a real browser, render only on pass',
      from: 0,
    }),
    rows.map((row, r) =>
      e(
        'div',
        {
          key: r,
          style: {
            position: 'absolute',
            top: r === 0 ? 330 : 640,
            left: 90,
            right: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
        },
        row.map(({ s, i }, k) => {
          const from = 40 + i * 60;
          return e(
            React.Fragment,
            { key: s[0] },
            e(StepCard, { n: s[0], label: s[1], sub: s[2], from }),
            k < row.length - 1 ? e(Arrow, { from: from + 40 }) : null,
          );
        }),
      ),
    ),
    e(
      'div',
      { style: { position: 'absolute', top: 900, left: 90, right: 90, textAlign: 'center', ...fadeAt(40 + 8 * 60) } },
      e(
        'div',
        {
          style: {
            display: 'inline-block',
            backgroundColor: '#ecfdf5',
            border: `2px solid ${GREEN}`,
            color: GREEN,
            fontSize: 26,
            fontWeight: 800,
            borderRadius: 999,
            padding: '12px 28px',
          },
        },
        'total check: ~60 seconds, not 4 minutes',
      ),
    ),
  );
}

const GALLERY = [
  ['Frame 150', 'all 7 chips fully visible, none cut off'],
  ['Frame 420', 'logo and CTA text fully visible'],
];

function SceneKane() {
  const cards = GALLERY.map(([label, expect], i) =>
    e(
      'div',
      { key: label, style: { flex: 1, padding: 12, ...fadeAt(60 + i * 50) } },
      e(
        Card,
        { fadeFrom: 0, accent: ACCENT, width: '100%' },
        e('div', { style: { fontSize: 34, fontWeight: 800, color: INK } }, label),
        e(
          'div',
          {
            style: {
              marginTop: 10,
              height: 190,
              borderRadius: 12,
              backgroundColor: '#dbe4f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'monospace',
              fontSize: 24,
              color: MUTED,
            },
          },
          'frame PNG',
        ),
        e('div', { style: { fontSize: 22, color: MUTED, marginTop: 12 } }, `expects: ${expect}`),
      ),
    ),
  );
  const lines = [
    ['OBSERVATION 150: PASS - all chips fully visible', GREEN],
    ['OBSERVATION 420: FAIL - logo covers the CTA text', RED],
    ['run_end: failed -> exit 11, render never starts', RED],
  ];
  return e(
    AbsoluteFill,
    { style: { ...DOT_BG, fontFamily: 'sans-serif', color: INK, overflow: 'hidden' } },
    e(Header, {
      pill: 'KANE DOES THE JUDGING',
      pillColor: DARK,
      title: 'Kane opens the gallery and judges each frame',
      sub: 'kane-cli run "<objective>" --agent --headless --url http://127.0.0.1:<port>/',
      from: 0,
    }),
    e(
      'div',
      { style: { position: 'absolute', top: 300, left: 90, right: 90, ...fadeAt(40) } },
      e(
        'div',
        {
          style: {
            backgroundColor: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 18,
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
            overflow: 'hidden',
          },
        },
        e(
          'div',
          {
            style: {
              backgroundColor: '#eef2f7',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            },
          },
          e('div', { style: { width: 12, height: 12, borderRadius: 6, backgroundColor: RED } }),
          e('div', { style: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#f59e0b' } }),
          e('div', { style: { width: 12, height: 12, borderRadius: 6, backgroundColor: GREEN } }),
          e(
            'div',
            {
              style: {
                marginLeft: 14,
                backgroundColor: '#fff',
                border: `1px solid ${BORDER}`,
                borderRadius: 999,
                padding: '6px 18px',
                fontFamily: 'monospace',
                fontSize: 20,
                color: MUTED,
              },
            },
            'http://127.0.0.1:<port>/',
          ),
        ),
        e('div', { style: { padding: 20, display: 'flex' } }, cards),
      ),
    ),
    e(
      'div',
      { style: { position: 'absolute', top: 640, left: 90, right: 90 } },
      e(
        Card,
        { fadeFrom: 220, accent: DARK, width: '100%' },
        e(
          'div',
          { style: { backgroundColor: DARK, borderRadius: 12, padding: '18px 26px', minHeight: 170, boxSizing: 'border-box' } },
          lines.map(([text, color], i) => {
            const f = fadeAt(260 + i * 60, 14);
            return e('div', { key: text, style: f }, e(Mono, { size: 24, color }, text));
          }),
        ),
      ),
    ),
  );
}

function VerdictCard({ from, danger }) {
  const f = fadeAt(from);
  const color = danger ? RED : GREEN;
  const title = danger ? 'FAIL - exit 11' : 'PASS - exit 0';
  const lines = danger
    ? ['render never starts', 'evidence: .framevet/<runId>/ (frame PNGs, kane.ndjson)']
    : ['render runs ONCE', 'output: out/<Composition>.mp4'];
  return e(
    'div',
    { style: { flex: 1, ...f } },
    e(
      Card,
      { fadeFrom: 0, accent: color, width: '100%' },
      e('div', { style: { fontSize: 34, fontWeight: 800, color } }, title),
      lines.map((t) =>
        e('div', { key: t, style: { fontSize: 23, color: INK, marginTop: 10, fontFamily: 'monospace' } }, t),
      ),
    ),
  );
}

function SceneHasil() {
  const recap = [
    ['WITHOUT framevet', 'wait ~4 min for the render, only then find the bug', RED, '#fef2f2'],
    ['WITH framevet', '~60 s: clear PASS/FAIL per frame, render only on PASS', GREEN, '#ecfdf5'],
  ];
  return e(
    AbsoluteFill,
    { style: { ...DOT_BG, fontFamily: 'sans-serif', color: INK, overflow: 'hidden' } },
    e(Header, {
      pill: 'RESULT',
      pillColor: GREEN,
      title: 'The expensive render only runs when the gate passes',
      from: 0,
    }),
    e(
      'div',
      { style: { position: 'absolute', top: 300, left: 90, right: 90 } },
      recap.map(([tag, text, color, bg], i) => {
        const f = fadeAt(60 + i * 70);
        return e(
          'div',
          {
            key: tag,
            style: {
              display: 'flex',
              alignItems: 'center',
              backgroundColor: bg,
              border: `2px solid ${color}`,
              borderRadius: 16,
              padding: '20px 26px',
              marginBottom: 18,
              ...f,
            },
          },
          e(
            'div',
            { style: { fontSize: 22, fontWeight: 800, color, letterSpacing: 1, marginRight: 24, whiteSpace: 'nowrap' } },
            tag,
          ),
          e('div', { style: { fontSize: 27, fontWeight: 600, color: INK } }, text),
        );
      }),
    ),
    e(
      'div',
      { style: { position: 'absolute', top: 560, left: 90, right: 90, display: 'flex', gap: 30 } },
      e(VerdictCard, { from: 220, danger: true }),
      e(VerdictCard, { from: 320, danger: false }),
    ),
    e(
      'div',
      { style: { position: 'absolute', top: 830, width: '100%', textAlign: 'center', ...fadeAt(440) } },
      e(Mono, { size: 27, color: INK }, 'framevet check  <Composition> --json'),
      e(Mono, { size: 27, color: INK }, 'framevet render <Composition>   # gate first, render once on PASS'),
      e(
        'div',
        { style: { marginTop: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, ...fadeAt(520) } },
      ),
    ),
    e(
      'div',
      { style: { position: 'absolute', bottom: 60, width: '100%', textAlign: 'center', ...fadeAt(560) } },
      e(
        'div',
        {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            backgroundColor: '#ecfdf5',
            border: `2px solid ${GREEN}`,
            borderRadius: 999,
            padding: '12px 26px',
          },
        },
        e('div', { style: { width: 18, height: 18, borderRadius: 9, backgroundColor: GREEN } }),
        e('div', { style: { fontSize: 26, fontWeight: 800, color: GREEN } }, 'github.com/kroto69/framevet - Verified with Kane CLI'),
      ),
    ),
  );
}

export function Explainer() {
  const frame = useCurrentFrame();
  const titleIn = spring({ frame, fps: 30, config: { damping: 16, mass: 0.7 } });
  return e(
    AbsoluteFill,
    { style: { ...DOT_BG, fontFamily: 'sans-serif', color: INK, overflow: 'hidden', opacity: interpolate(titleIn, [0, 1], [0.6, 1]) } },
    e(Sequence, { from: 0, durationInFrames: 1237 }, e(SceneTanpa)),
    e(Sequence, { from: 1237, durationInFrames: 1238 }, e(SceneDengan)),
    e(Sequence, { from: 2475, durationInFrames: 1237 }, e(SceneKane)),
    e(Sequence, { from: 3712, durationInFrames: 1238 }, e(SceneHasil)),
  );
}
