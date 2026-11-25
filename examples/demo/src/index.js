import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { PromoVideo } from './PromoVideo.js';

const e = React.createElement;

export const RemotionRoot = () =>
  e(Composition, {
    id: 'PromoVideo',
    component: PromoVideo,
    durationInFrames: 450,
    fps: 30,
    width: 1080,
    height: 1920,
    defaultProps: {},
  });

registerRoot(RemotionRoot);
