// 本の設定・カメラ・ページめくりの状態
import { DEFAULT_SPREADS } from './data/presets.js';

export const state = {
  bookTitle: 'GRIMOIRE',
  coverColor: '#7c2d36',
  metalColor: '#d4a853',
  paperColor: '#dcd0b8',
  bgColor: '#e4e2dd',
  proportion: 'standard',
  corners: 'chunky',
  coverPattern: 'arcane',
  emblem: 'compass',
  thickness: 0.54,
  openTarget: 1.0,
  openCurrent: 1.0,
  tabs: true,
  flatShading: true,
  autoRotate: false,
  currentSpread: 0,
  spreadVisual: 0, // Continuous spread index for smooth dynamic stack thickness
  spreads: JSON.parse(JSON.stringify(DEFAULT_SPREADS))
};

export const camOrbit = {
  theta: 0.0,
  phi: 0.92,
  radius: 7.1,
  targetTheta: 0.0,
  targetPhi: 0.92,
  targetRadius: 7.1,
  isDragging: false,
  prevX: 0,
  prevY: 0,
  pinchDist: 0
};

export const flipAnim = {
  active: false,
  dir: 1,
  progress: 0,
  fromSpread: 0,
  nextSpread: 0,
  manualScrub: false,
  scrubProgress: 0
};
