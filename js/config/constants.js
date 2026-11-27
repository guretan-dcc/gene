// --- ボクセルID ---
export const VOX = {
  AIR: 0,
  FLOOR0: 1,   // 平地床 (H0)
  FLOOR1: 2,   // 1段高台 (H1)
  FLOOR2: 3,   // 2段高台 (H2)
  FLOOR3: 4,   // 3段高台 (H3)
  PILLAR1: 5,  // 低遮蔽物
  PILLAR2: 6,  // 高遮蔽物
  UNDER: 7,    // 浮遊スラブ下面・土台
  RIM: 8       // 外周安全壁
};

// Clone Drone 公式7ティア準拠カラーテーマ
export const TIER_THEMES = {
  bronze:   { label: 'Bronze',   neon: 0xd97706, floor0: 0x363332, floor1: 0x4c4542, floor2: 0x625751, floor3: 0x786a62, pillar1: 0x6b5c52, pillar2: 0x857163, under: 0x1c1918, rim: 0x1a1716 },
  silver:   { label: 'Silver',   neon: 0x94a3b8, floor0: 0x334155, floor1: 0x475569, floor2: 0x5c6e85, floor3: 0x7286a0, pillar1: 0x64748b, pillar2: 0x8295ae, under: 0x192231, rim: 0x161f2e },
  gold:     { label: 'Gold',     neon: 0xfacc15, floor0: 0x2f3545, floor1: 0x434b61, floor2: 0x58617a, floor3: 0x6e7894, pillar1: 0x696452, pillar2: 0x8a815e, under: 0x181c28, rim: 0x151924 },
  diamond:  { label: 'Diamond',  neon: 0x38bdf8, floor0: 0x263547, floor1: 0x364d66, floor2: 0x476585, floor3: 0x597ea3, pillar1: 0x527494, pillar2: 0x6b95ba, under: 0x121c27, rim: 0x101924 },
  titanium: { label: 'Titanium', neon: 0xc084fc, floor0: 0x2c293d, floor1: 0x403b59, floor2: 0x544e73, floor3: 0x6a628f, pillar1: 0x685f8a, pillar2: 0x8378ab, under: 0x161422, rim: 0x13111f },
  uranium:  { label: 'Uranium',  neon: 0x4ade80, floor0: 0x22332c, floor1: 0x314a40, floor2: 0x406154, floor3: 0x507868, pillar1: 0x4a705d, pillar2: 0x608f78, under: 0x101a16, rim: 0x0e1714 },
  insanium: { label: 'Insanium', neon: 0xf43f5e, floor0: 0x2d1f26, floor1: 0x452d38, floor2: 0x5d3c4b, floor3: 0x754b5e, pillar1: 0x703b4a, pillar2: 0x914b5e, under: 0x170e13, rim: 0x140b10 }
};

export const PALETTE = {
  magma:     0xea580c,
  slope:     0x5b6f8a,
  pedBase:   0x1e293b,
  pedMelee:  0xb91c1c,
  pedRange:  0xca8a04,
  pedPlay:   0x0284c7,
  player:    0x38bdf8,
  melee:     0xef4444,
  ranged:    0xfacc15,
  jumpPad:   0x06b6d4,
  sawBlade:  0xe2e8f0,
  sawEdge:   0xf43f5e,
  fireTrap:  0xf97316,
  spikeBase: 0x475569,
  conveyor:  0x10b981
};

export const VR_EYE_HEIGHT = 1.6; // VR標準目線高さ(m)
export const VR_WALK_SPEED = 4.2; // VRChat歩行速度目安(m/s)
