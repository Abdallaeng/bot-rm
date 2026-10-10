/** اهتزاز خفيف عند الضغط على الأزرار (حيث يدعمه الجهاز) */
export function initHaptics() {
  if (!navigator.vibrate) return;
  document.addEventListener('click', (e) => {
    if (e.target.closest('.btn, .chip, .cchip, .gchip, .li, a[href^="tel:"], .k, .tab')) navigator.vibrate(8);
  }, { passive: true });
}
