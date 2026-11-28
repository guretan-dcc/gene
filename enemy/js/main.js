// 起動処理
import { state, saveSettings, restoreSettings } from './settings.js';
import { buildRobot } from './model/robot.js';
import { initScene, showRobot, resetCamera, render, joints } from './preview/scene.js';
import { applyMotion } from './preview/motion.js';
import { createEnemyPackage, safeName } from './export/unity.js';
import { bindPanel, syncPanel, showToast } from './ui/panel.js';

function rebuild(frame) {
  const parts = buildRobot(state);
  showRobot(parts, state.height);
  if (frame) resetCamera(state.height);
  const triangles = parts.reduce((sum, p) => sum + p.mesh.triangleCount, 0);
  document.getElementById('stats').textContent = `${triangles} tris / 部品 ${parts.length}`;
  saveSettings();
}

async function exportPackage() {
  try {
    const name = safeName(state.name);
    const url = URL.createObjectURL(await createEnemyPackage({ ...state }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}.unitypackage`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast(`${name}.unitypackage を書き出しました`);
  } catch (err) {
    console.error(err);
    showToast('unitypackage書き出し中にエラーが発生しました');
  }
}

function animate(now) {
  requestAnimationFrame(animate);
  applyMotion(joints, state.motion, now / 1000, state.weapon);
  render();
}

restoreSettings();
bindPanel(rebuild);
syncPanel();
initScene(document.getElementById('canvas'));
rebuild(true);
document.getElementById('btnExportUnity').addEventListener('click', exportPackage);
requestAnimationFrame(animate);
