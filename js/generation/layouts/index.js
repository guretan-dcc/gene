// 地形プリセット（<select id="preset"> の value）と彫刻関数の対応表
import { hyperCorridor } from './hyperCorridor.js';
import { steppedCanyon } from './steppedCanyon.js';
import { skyWalkways } from './skyWalkways.js';
import { octaDome } from './octaDome.js';
import { twinBridges } from './twinBridges.js';
import { gauntlet } from './gauntlet.js';

export { gauntlet };

export const LAYOUTS = {
  hyper_corridor: hyperCorridor,
  stepped_canyon: steppedCanyon,
  sky_walkways: skyWalkways,
  octa_dome: octaDome,
  twin_bridges: twinBridges,
  gauntlet
};
