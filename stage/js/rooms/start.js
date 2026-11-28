// 入口の小部屋
export const startRoom = {
  id: 'start',
  style: { floor: 0x7d828c, side: 0x3a3d45, wall: 0x4b4f59, accent: 0x8c2a2a, trim: 0x2b2d34, cover: 0x33363e },
  size: () => ({ half: 4, depth: 7 }),
  rise: () => 0,
  carve({ hw, d }, room) {
    room.floor(-hw, hw, 0, d - 1);
  },
  decorate(kit) {
    kit.pilasters(6, 0.5, kit.style.trim);
  }
};
