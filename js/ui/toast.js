let toastTimer = null;
export function showToast(msg) {
    const box = document.getElementById('toastBox');
    if (!box) return;
    box.textContent = msg;
    box.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.add('hidden'), 2800);
}
