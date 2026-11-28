// 部屋の一覧。部屋を追加するときはファイルを作ってここに登録する
import { startRoom } from './start.js';
import { bridgeRoom } from './bridge.js';
import { arenaRoom } from './arena.js';
import { shaftRoom } from './shaft.js';

export const ROOMS = { start: startRoom, bridge: bridgeRoom, arena: arenaRoom, shaft: shaftRoom };
export const COMBAT_ROOM_IDS = ['bridge', 'arena', 'shaft'];
export const CORRIDOR_STYLE = startRoom.style;
