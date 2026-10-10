/** معالجة النصوص: الأرقام العربية → لاتينية، وتطبيع العربية للبحث */
const DIGITS = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9, '۰': 0, '۱': 1, '۲': 2, '۳': 3, '۴': 4, '۵': 5, '۶': 6, '۷': 7, '۸': 8, '۹': 9 };

export const latinDigits = (s) => String(s).replace(/[٠-٩۰-۹]/g, (d) => DIGITS[d]);

export const normalizeArabic = (s) =>
  latinDigits(s)
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')   // التشكيل والتطويل
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();

export const formatDate = (iso) => {
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return ''; }
};
export const formatIsoDate = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('/') : s);
