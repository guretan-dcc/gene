// Unity 風の数値ドラッグ調整
// - 数値欄、または数値欄のある行のラベルを左右にドラッグして値を変更する
// - 数値欄はクリックのみ（ほぼ動かさない）なら通常どおり入力できる
// - Shift: 速く / Alt: ゆっくり
import { clamp } from '../utils/math.js';

const THRESHOLD_PX = 3;        // これ以上動いたらドラッグ開始とみなす
const PIXELS_FOR_FULL_RANGE = 300; // 最小〜最大を動かすのに必要なpx（通常速度）

function findNumberInput(target) {
    if (!(target instanceof Element)) return null;
    if (target.matches('input.u-num[type="number"]')) return target;
    const label = target.closest('.u-label');
    if (label) {
        const row = label.closest('.u-row');
        return row ? row.querySelector('input.u-num[type="number"]') : null;
    }
    return null;
}

function decimalsOf(step) {
    const s = String(step);
    return s.includes('.') ? s.split('.')[1].length : 0;
}

export function setupNumberScrub() {
    document.addEventListener('pointerdown', onPointerDown, true);
}

function onPointerDown(e) {
    if (e.button !== 0) return;
    const num = findNumberInput(e.target);
    if (!num || num.disabled || num.readOnly) return;

    const slider = (num.parentElement && num.parentElement.querySelector('.u-slider')) || null;
    const min = parseFloat(num.min);
    const max = parseFloat(num.max);
    const hasRange = Number.isFinite(min) && Number.isFinite(max) && max > min;
    const step = parseFloat(num.step) > 0 ? parseFloat(num.step) : 1;
    const decimals = decimalsOf(step);
    const basePerPx = hasRange ? (max - min) / PIXELS_FOR_FULL_RANGE : step;

    let startX = e.clientX;
    let startVal = parseFloat(num.value) || 0;
    let active = false;
    const pointerId = e.pointerId;
    const captureEl = e.target;

    function setValue(v) {
        num.value = v;
        if (slider) {
            // スライダー行は既存の input ハンドラ経由でそのまま反映（ドラッグ中も3D更新）
            slider.value = v;
            slider.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    function onMove(ev) {
        const dx = ev.clientX - startX;
        if (!active) {
            if (Math.abs(dx) < THRESHOLD_PX) return;
            active = true;
            if (document.activeElement === num) num.blur();
            document.body.classList.add('u-scrubbing');
            try { captureEl.setPointerCapture(pointerId); } catch (_) { /* noop */ }
            startX = ev.clientX;
            startVal = parseFloat(num.value) || 0;
            return;
        }
        ev.preventDefault();
        const speed = ev.shiftKey ? 5 : (ev.altKey ? 0.2 : 1);
        let v = startVal + (ev.clientX - startX) * basePerPx * speed;
        v = Math.round(v / step) * step;
        if (hasRange) v = clamp(v, min, max);
        v = Number(v.toFixed(decimals));
        if (String(v) !== num.value) setValue(v);
    }

    function onUp() {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        if (!active) return;
        document.body.classList.remove('u-scrubbing');
        // スライダーの無い数値欄は、描画し直しを伴うためドラッグ終了時に確定する
        if (!slider) num.dispatchEvent(new Event('change', { bubbles: true }));
        // ドラッグ直後の click（島の選択など）を無効化
        const swallow = ev => ev.stopPropagation();
        window.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', swallow, true), 0);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
}
