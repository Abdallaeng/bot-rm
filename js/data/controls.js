/** تحكمات المنصة على الجهاز: القيم من لوحة الإدارة (/api/controls) محفوظة محلياً (LS brm_ctl) فتعمل حتى بدون إنترنت.
 *  ctl(key) تعيد قيمة الإدارة أو الافتراضية. التطبيق على الواجهة في ui/controlsUi.js */
import { LS } from '../lib/storage.js';
import { DEFAULTS, cleanControls } from './controlsSchema.js';

let C = {};
export const ctl = (k) => (k in C ? C[k] : DEFAULTS[k]);
export const getControls = () => C;
export const setControls = (obj) => { C = cleanControls(obj); };
export const loadSavedControls = () => { const s = LS.get('brm_ctl', null); setControls(s?.c); return s || { v: 0, c: {}, fd: 0, fa: 0 }; };
export const saveControls = (doc) => { LS.set('brm_ctl', { v: doc.v || 0, c: cleanControls(doc.c), fd: doc.fd || 0, fa: doc.fa || 0 }); setControls(doc.c); };
