import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame } from 'remotion';

const e = React.createElement;

// framevet-demo:bug-switch — toggled by `npm run demo:break` / `npm run demo:fix`
const DEMO_BROKEN = false; /* framevet-demo:bug-switch */

const FPS = 30;
const MODELS = ['Aria', 'Bolt', 'Cove', 'Dune', 'Echo', 'Flux', 'Gale'];

function Chip({ name, index }) {
  const frame = useCurrentFrame();
  const appearAt = index * 20;
  const opacity = interpolate(frame, [appearAt, appearAt + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const width = DEMO_BROKEN ? 200 : 130;
  return e(
    'div',
    {
      style: {
        width,
        margin: 8,
        padding: '18px 0',
        boxSizing: 'border-box',
        textAlign: 'center',
        fontSize: DEMO_BROKEN ? 44 : 30,
        fontWeight: 700,
        backgroundColor: '#24406e',
        borderRadius: 16,
        opacity,
      },
    },
    name,
  );
}

export function PromoVideo() {
  const frame = useCurrentFrame();
  const headline = spring({ frame, fps: FPS, config: { damping: 14, mass: 0.6 } });
  const outro = interpolate(frame, [300, 330], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return e(
    AbsoluteFill,
    {
      style: {
        backgroundColor: '#0b1020',
        color: 'white',
        fontFamily: 'sans-serif',
        overflow: 'hidden',
      },
    },
    e(
      'div',
      {
        style: {
          position: 'absolute',
          top: 140,
          width: '100%',
          textAlign: 'center',
          opacity: headline,
          transform: `translateY(${interpolate(headline, [0, 1], [90, 0])}px)`,
        },
      },
      e('div', { style: { fontSize: 96, fontWeight: 800 } }, 'Meet the fleet'),
    ),
    e(
      'div',
      {
        style: {
          position: 'absolute',
          top: 320,
          width: '100%',
          textAlign: 'center',
          fontSize: 40,
          color: '#9fb0d0',
        },
      },
      'Seven models. One gate.',
    ),
    e(
      'div',
      {
        style: {
          position: 'absolute',
          top: 860,
          left: 0,
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
        },
      },
      MODELS.map((name, i) => e(Chip, { key: name, name, index: i })),
    ),
    e(
      'div',
      { style: { position: 'absolute', bottom: 120, left: 80, opacity: outro } },
      e(Img, { src: staticFile('logo.svg'), style: { height: 140 } }),
    ),
    e(
      'div',
      { style: { position: 'absolute', bottom: 300, right: 80, textAlign: 'right', opacity: outro } },
      e('div', { style: { fontSize: 64, fontWeight: 700 } }, 'Render with confidence'),
      e(
        'div',
        { style: { fontSize: 36, color: '#9fb0d0', marginTop: 12 } },
        'framevet checks the frames first',
      ),
    ),
  );
}
