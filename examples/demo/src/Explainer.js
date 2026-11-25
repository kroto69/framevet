import React from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from 'remotion';

const e = React.createElement;

const BG = '#f6f7f9';
const INK = '#0f172a';
const MUTED = '#64748b';
const ACCENT = '#2563eb';
const GREEN = '#15803d';
const RED = '#dc2626';
const CARD = '#ffffff';
const BORDER = '#e2e8f0';
const DARK = '#0f172a';

function fadeAt(from, span = 18) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [from, from + span], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return { opacity: p, transform: `translateY(${interpolate(p, [0, 1], [28, 0])}px)` };
}

function Heading({ title, sub, from = 0 }) {
  const f = fadeAt(from);
  return e(
    'div',
    { style: { position: 'absolute', top: 90, width: '100%', textAlign: 'center', ...f } },
    e('div', { style: { fontSize: 64, fontWeight: 800, color: INK } }, title),
    sub ? e('div', { style: { fontSize: 32, color: MUTED, marginTop: 18 } }, sub) : null,
  );
}

function Card({ fadeFrom, color, width = 380, children }) {
  const f = fadeAt(fadeFrom);
  return e(
    'div',
    {
      style: {
        width,
        boxSizing: 'border-box',
        backgroundColor: CARD,
        border: `2px solid ${BORDER}`,
        borderTop: `8px solid ${color}`,
        borderRadius: 18,
        padding: '26px 28px',
        opacity: f.opacity,
        transform: f.transform,
      },
    },
    children,
  );
}

function Mono({ children, size = 26, color = '#e2e8f0', weight = 600 }) {
  return e(
    'div',
    { style: { fontFamily: 'monospace', fontSize: size, color, fontWeight: weight, lineHeight: 1.5 } },
    children,
  );
}

function SceneProblem() {
  const t1 = fadeAt(10);
  const t2 = fadeAt(60);
  const t3 = fadeAt(130);
  const bar = fadeAt(200, 30);
  const frame = useCurrentFrame();
  const barP = interpolate(frame, [210, 560], [0.04, 0.97], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return e(
    AbsoluteFill,
    { style: { backgroundColor: BG } },
    e(
      'div',
      { style: { position: 'absolute', top: 330, width: '100%', textAlign: 'center', ...t1 } },
      e('div', { style: { fontSize: 88, fontWeight: 800, color: INK } }, 'Agents write the code.'),
    ),
    e(
      'div',
      { style: { position: 'absolute', top: 470, width: '100%', textAlign: 'center', ...t2 } },
      e('div', { style: { fontSize: 88, fontWeight: 800, color: RED } }, 'Agents cannot see the render.'),
    ),
    e(
      'div',
      { style: { position: 'absolute', top: 640, width: '100%', textAlign: 'center', ...t3 } },
      e('div', { style: { fontSize: 38, color: MUTED } }, 'Bugs surface only after a slow full render.'),
    ),
    e(
      'div',
      {
        style: {
          position: 'absolute',
          top: 800,
          left: '50%',
          width: 900,
          marginLeft: -450,
          ...bar,
        },
      },
      e(
        'div',
        { style: { fontFamily: 'monospace', fontSize: 26, color: MUTED, marginBottom: 12 } },
        'npx remotion render ... 4 min later',
      ),
      e(
        'div',
        { style: { height: 26, borderRadius: 13, backgroundColor: BORDER, overflow: 'hidden' } },
        e('div', { style: { height: '100%', width: `${barP * 100}%`, backgroundColor: ACCENT } }),
      ),
    ),
  );
}

const PIPELINE = [
  ['framevet.config.json', 'frames + expectations', ACCENT],
  ['browser ensure', 'preflight, no timer', ACCENT],
  ['remotion still --frame=N', 'one frame at a time', ACCENT],
  ['gallery index.html', 'frames + labels side by side', ACCENT],
  ['serve 127.0.0.1:<port>', 'random localhost port', ACCENT],
  ['kane-cli run --objective', 'Kane opens the page', ACCENT],
  ['OBSERVATION <N>: PASS|FAIL', 'one line per frame', ACCENT],
  ['verdict', 'PASS only if all PASS', INK],
];

function ScenePipeline() {
  const h = fadeAt(0);
  const boxes = PIPELINE.map(([label, sub, color], i) =>
    e(
      'div',
      { key: label, style: { width: '25%', padding: 14, boxSizing: 'border-box' } },
      e(
        Card,
        { fadeFrom: 40 + i * 22, color, width: '100%' },
        e('div', { style: { fontFamily: 'monospace', fontSize: 25, fontWeight: 700, color: INK } }, label),
        e('div', { style: { fontSize: 22, color: MUTED, marginTop: 8 } }, sub),
      ),
    ),
  );
  const b1 = fadeAt(40 + PIPELINE.length * 22 + 10);
  const b2 = fadeAt(40 + PIPELINE.length * 22 + 34);
  return e(
    AbsoluteFill,
    { style: { backgroundColor: BG } },
    e(
      'div',
      { style: { position: 'absolute', top: 80, width: '100%', textAlign: 'center', ...h } },
      e('div', { style: { fontSize: 62, fontWeight: 800, color: INK } }, 'framevet gates the render'),
      e(
        'div',
        { style: { fontSize: 30, color: MUTED, marginTop: 14 } },
        'a few key frames, judged by Kane, before the full render',
      ),
    ),
    e(
      'div',
      {
        style: {
          position: 'absolute',
          top: 250,
          left: 90,
          right: 90,
          display: 'flex',
          flexWrap: 'wrap',
        },
      },
      boxes.slice(0, 4),
      boxes.slice(4),
    ),
    e(
      'div',
      { style: { position: 'absolute', top: 730, left: 90, right: 90, display: 'flex', gap: 40 } },
      e(
        'div',
        { style: { flex: 1, ...b1 } },
        e(
          Card,
          { fadeFrom: 0, color: RED, width: '100%' },
          e('div', { style: { fontSize: 34, fontWeight: 800, color: RED } }, 'FAIL - exit 11'),
          e('div', { style: { fontSize: 26, color: INK, marginTop: 10 } }, 'no render starts'),
          e(
            'div',
            { style: { fontFamily: 'monospace', fontSize: 23, color: MUTED, marginTop: 8 } },
            'evidence: .framevet/<runId>/ (frames, index.html, kane.ndjson)',
          ),
        ),
      ),
      e(
        'div',
        { style: { flex: 1, ...b2 } },
        e(
          Card,
          { fadeFrom: 0, color: GREEN, width: '100%' },
          e('div', { style: { fontSize: 34, fontWeight: 800, color: GREEN } }, 'PASS - exit 0'),
          e('div', { style: { fontSize: 26, color: INK, marginTop: 10 } }, 'render runs ONCE'),
          e(
            'div',
            { style: { fontFamily: 'monospace', fontSize: 23, color: MUTED, marginTop: 8 } },
            'out/<Composition>.mp4',
          ),
        ),
      ),
    ),
  );
}

const GALLERY = [
  ['Frame 150', 'all 7 model chips fully visible, none cut off'],
  ['Frame 420', 'logo and CTA text fully visible'],
];

function SceneKane() {
  const cards = GALLERY.map(([label, expect], i) => {
    const f = fadeAt(30 + i * 40);
    return e(
      'div',
      { key: label, style: { flex: 1, padding: 16, ...f } },
      e(
        Card,
        { fadeFrom: 0, color: ACCENT, width: '100%' },
        e('div', { style: { fontSize: 40, fontWeight: 800, color: INK } }, label),
        e(
          'div',
          { style: { marginTop: 10, height: 300, borderRadius: 12, backgroundColor: '#dbe4f0' } },
          e(
            'div',
            {
              style: {
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'monospace',
                fontSize: 30,
                color: MUTED,
              },
            },
            'frame PNG',
          ),
        ),
        e('div', { style: { fontSize: 24, color: MUTED, marginTop: 14 } }, `expects: ${expect}`),
      ),
    );
  });
  const lines = [
    ['OBSERVATION 150: FAIL - last chip cut off at the right edge', RED],
    ['OBSERVATION 420: PASS - logo and CTA fully visible', GREEN],
    ['verdict: FAIL -> exit 11, render never starts', RED],
  ];
  return e(
    AbsoluteFill,
    { style: { backgroundColor: BG } },
    e(Heading, { title: 'Kane opens the gallery', sub: 'kane-cli run --objective "...OBSERVATION <N>: PASS|FAIL - ..."', from: 0 }),
    e(
      'div',
      { style: { position: 'absolute', top: 260, left: 120, right: 120, display: 'flex' } },
      cards,
    ),
    e(
      'div',
      { style: { position: 'absolute', top: 700, left: 120, right: 120 } },
      e(
        Card,
        { fadeFrom: 130, color: DARK, width: '100%' },
        e(
          'div',
          {
            style: {
              backgroundColor: DARK,
              borderRadius: 12,
              padding: '24px 30px',
              minHeight: 190,
              boxSizing: 'border-box',
            },
          },
          lines.map(([text, color], i) => {
            const f = fadeAt(150 + i * 45, 14);
            return e(
              'div',
              { key: text, style: { ...f, opacity: f.opacity } },
              e(Mono, { size: 27, color }, text),
            );
          }),
        ),
      ),
    ),
  );
}

function JsonCard({ fadeFrom, lines }) {
  return e(
    'div',
    { style: { ...fadeAt(fadeFrom) } },
    e(
      Card,
      { fadeFrom: 0, color: DARK, width: '100%' },
      e(
        'div',
        { style: { backgroundColor: DARK, borderRadius: 12, padding: '26px 32px' } },
        lines.map(([text, color]) => e('div', { key: text }, e(Mono, { size: 27, color }, text))),
      ),
    ),
  );
}

function SceneFail() {
  const banner = fadeAt(0);
  return e(
    AbsoluteFill,
    { style: { backgroundColor: BG } },
    e(
      'div',
      { style: { position: 'absolute', top: 110, width: '100%', textAlign: 'center', ...banner } },
      e('div', { style: { fontSize: 76, fontWeight: 800, color: RED } }, 'GATE FAILED - exit 11'),
      e(
        'div',
        { style: { fontSize: 32, color: MUTED, marginTop: 16 } },
        'Kane saw the bug in frame 150 - the render never started',
      ),
    ),
    e(
      'div',
      { style: { position: 'absolute', top: 330, left: 260, right: 260 } },
      e(JsonCard, {
        fadeFrom: 50,
        lines: [
          ['{"composition":"PromoVideo","ok":false,"code":11,', '#e2e8f0'],
          [' "reason":"frame 150: FAIL - last chip cut off",', '#fca5a5'],
          [' "rendered":false}', '#fca5a5'],
        ],
      }),
    ),
    e(
      'div',
      { style: { position: 'absolute', top: 700, width: '100%', textAlign: 'center', ...fadeAt(120) } },
      e(
        'div',
        { style: { fontFamily: 'monospace', fontSize: 28, color: INK } },
        'evidence kept: .framevet/<runId>/frames/  index.html  kane.ndjson',
      ),
      e('div', { style: { fontSize: 28, color: MUTED, marginTop: 18 } }, 'agent reads reason + observations, fixes the composition, reruns the gate'),
    ),
  );
}

function ScenePass() {
  const banner = fadeAt(0);
  return e(
    AbsoluteFill,
    { style: { backgroundColor: BG } },
    e(
      'div',
      { style: { position: 'absolute', top: 100, width: '100%', textAlign: 'center', ...banner } },
      e('div', { style: { fontSize: 76, fontWeight: 800, color: GREEN } }, 'GATE PASSED - exit 0'),
      e(
        'div',
        { style: { fontSize: 32, color: MUTED, marginTop: 14 } },
        'every frame has an OBSERVATION line and all are PASS',
      ),
    ),
    e(
      'div',
      { style: { position: 'absolute', top: 300, left: 260, right: 260 } },
      e(JsonCard, {
        fadeFrom: 40,
        lines: [
          ['OBSERVATION 150: PASS - all 7 chips fully visible', '#86efac'],
          ['OBSERVATION 420: PASS - logo and CTA fully visible', '#86efac'],
          ['{"ok":true,"code":0,"rendered":true} -> out/PromoVideo.mp4', '#e2e8f0'],
        ],
      }),
    ),
    e(
      'div',
      { style: { position: 'absolute', top: 660, width: '100%', textAlign: 'center', ...fadeAt(110) } },
      e('div', { style: { fontFamily: 'monospace', fontSize: 30, color: INK } }, 'framevet check  <Composition> --json'),
      e('div', { style: { fontFamily: 'monospace', fontSize: 30, color: INK, marginTop: 10 } }, 'framevet render <Composition>   # gate, then render once'),
      e(
        'div',
        { style: { fontSize: 28, color: ACCENT, fontWeight: 700, marginTop: 26 } },
        'github.com/kroto69/framevet - Verified with Kane CLI',
      ),
    ),
  );
}

export function Explainer() {
  return e(
    AbsoluteFill,
    { style: { backgroundColor: BG, color: INK, fontFamily: 'sans-serif', overflow: 'hidden' } },
    e(Sequence, { from: 0, durationInFrames: 600 }, e(SceneProblem)),
    e(Sequence, { from: 600, durationInFrames: 1200 }, e(ScenePipeline)),
    e(Sequence, { from: 1800, durationInFrames: 1200 }, e(SceneKane)),
    e(Sequence, { from: 3000, durationInFrames: 1050 }, e(SceneFail)),
    e(Sequence, { from: 4050, durationInFrames: 900 }, e(ScenePass)),
  );
}
