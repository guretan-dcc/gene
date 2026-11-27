import { VOX, TIER_THEMES } from './constants.js';
import { state } from '../state.js';

export function getTierTheme() {
  return TIER_THEMES[state.tier] || TIER_THEMES.gold;
}

export function getVoxelColor(voxId) {
  const th = getTierTheme();
  switch (voxId) {
    case VOX.FLOOR0:  return th.floor0;
    case VOX.FLOOR1:  return th.floor1;
    case VOX.FLOOR2:  return th.floor2;
    case VOX.FLOOR3:  return th.floor3;
    case VOX.PILLAR1: return th.pillar1;
    case VOX.PILLAR2: return th.pillar2;
    case VOX.UNDER:   return th.under;
    case VOX.RIM:     return th.rim;
    default:          return th.floor0;
  }
}
