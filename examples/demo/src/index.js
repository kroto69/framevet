import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { PromoVideo } from './PromoVideo.js';
import { Explainer } from './Explainer.js';

const e = React.createElement;

export const RemotionRoot = () =>
  e(
    React.Fragment,
    null,
    e(Composition, {
      id: 'PromoVideo',
      component: PromoVideo,
      durationInFrames: 450,
      fps: 30,
      width: 1080,
      height: 1920,
      defaultProps: {},
    }),
    e(Composition, {
      id: 'Explainer',
      component: Explainer,
      durationInFrames: 4950,
      fps: 30,
      width: 1920,
      height: 1080,
      defaultProps: {},
    }),
  );

registerRoot(RemotionRoot);
