let toastTimer = null;

export function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('opacity-0');
  el.classList.add('opacity-100');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('opacity-100');
    el.classList.add('opacity-0');
  }, 2200);
}
