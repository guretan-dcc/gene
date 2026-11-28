// 通知

let toastTimer = null;

export function showToast(msg) {
  const box = document.getElementById('toast-box');
  const label = document.getElementById('toast-msg');
  if (!box || !label) return;
  label.textContent = msg;
  box.classList.remove('opacity-0', '-translate-y-1');
  box.classList.add('opacity-100', 'translate-y-0');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    box.classList.add('opacity-0', '-translate-y-1');
    box.classList.remove('opacity-100', 'translate-y-0');
  }, 2200);
}
