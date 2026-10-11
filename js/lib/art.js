/** رسوم الحالات الفارغة: خط بسيط بلون التمييز، لكل حالة رسم يناسب معناها */
const A = (body) => `<svg viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ART = {
  search: A('<circle cx="42" cy="42" r="22" opacity=".9"/><path d="m58 58 22 22"/><path d="M42 30v24M34 54l8-24 8 24M36 44h12" opacity=".55"/><path d="M14 20h10M10 28h6M74 14h8" opacity=".35"/>'),
  list: A('<rect x="16" y="14" width="64" height="68" rx="10" opacity=".9"/><path d="M28 34h40M28 48h40M28 62h24" opacity=".55"/><path d="m60 66 6 6 12-14" stroke-width="3" opacity=".9"/>'),
  layers: A('<path d="m48 14 34 18-34 18-34-18z" opacity=".9"/><path d="m14 48 34 18 34-18" opacity=".6"/><path d="m14 64 34 18 34-18" opacity=".35"/>'),
  inbox: A('<path d="M14 54 24 22h48l10 32v20a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6z" opacity=".9"/><path d="M14 54h22a6 6 0 0 0 6 8h12a6 6 0 0 0 6-8h22" opacity=".6"/>'),
  chart: A('<path d="M16 80h66" opacity=".5"/><rect x="22" y="52" width="12" height="28" rx="3" opacity=".55"/><rect x="42" y="36" width="12" height="44" rx="3" opacity=".8"/><rect x="62" y="22" width="12" height="58" rx="3"/>'),
  clock: A('<circle cx="48" cy="48" r="30" opacity=".9"/><path d="M48 30v19l13 8" opacity=".7"/><path d="M14 20h8M74 76h8" opacity=".35"/>'),
};

/** بطاقة حالة فارغة موحّدة: رسم + عنوان + توضيح (+ محتوى إضافي) */
export const emptyState = (kind, title, hint = '', extra = '') =>
  `<div class="empty">${ART[kind] || ART.inbox}<b>${title}</b>${hint}${extra}</div>`;
