/* Bot Rm — core: Excel parsing + encryption (works in browser and Node) */
(function (root) {
  'use strict';
  const COLMAP = {
    'site id': 'id', 'cluster': 'cl', 'site type': 'st', 'site name': 'nm',
    'maintenance name': 'mn', 'maintenance number': 'mp', 'invoice number': 'inv',
    'severity': 'sev', 'indoor or outdoor': 'io', 'govt': 'gov', 'owner number': 'own',
    'vendor': 'ven', 'announcement date': 'ad', 'announcement hybrid date': 'ah',
    'announcement normal date': 'an', 'subcontractor': 'sub', 'comment': 'cm',
    'longitude': 'lon', 'latitude': 'lat', 'site type2': 't2', 'associated': 'as'
  };
  const DATE_KEYS = ['ad', 'ah', 'an'];
  const PHONE_KEYS = ['mp', 'inv', 'own'];
  const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
  const clean = v => {
    if (v == null) return '';
    if (typeof v === 'number') return String(v);
    if (v instanceof Date) return '';
    const s = String(v).replace(/[ \s]+/g, ' ').trim();
    if (/^#(N\/A|REF!|VALUE!|NAME\?)$/i.test(s)) return '';
    return s;
  };
  const pad = n => (n < 10 ? '0' : '') + n;
  function serialToDate(n) {
    if (!(n >= 1)) return '';
    const d = new Date(Math.round((Math.floor(n) - 25569) * 86400000));
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function dateVal(v) {
    if (v == null) return '';
    if (typeof v === 'number') return serialToDate(v);
    if (v instanceof Date) {
      if (v.getUTCFullYear() < 1950) return '';
      return v.getUTCFullYear() + '-' + pad(v.getUTCMonth() + 1) + '-' + pad(v.getUTCDate());
    }
    const s = clean(v);
    if (!s || /^0+&?$/.test(s) || s === '&') return '';
    return s;
  }
  function phoneVal(v) {
    let s = clean(v);
    if (!s) return '';
    if (/^7\d{9}$/.test(s)) s = '0' + s;
    return s;
  }
  function siteType(s) {
    return clean(s).replace(/\s*\(\s*/g, ' (').replace(/\s*\)\s*/g, ')');
  }

  /* ---------- أوراق إضافية: تُدمج بياناتها في حقل x لكل موقع ----------
     كل مدخل: اسم الورقة، عمود رقم الموقع، والأعمدة المطلوبة (اسم الحقل ← عنوان العمود [، رقم التكرار]).
     عنوان العمود يمكن أن يكون نصاً (مطابقة تامة) أو تعبيراً نمطياً. الأولوية للأوراق الأولى في القائمة. */
  const EXTRA_SHEETS = [
    { sheet: /^sheet2$/i, key: ['site code'], dates: ['onAir', 'annDate'], cols: {
      siteStatus: ['site status'], client: ['client'], project: ['project type'], omCat: ['o&m category'], omAm: ['o&m am'], omRm: ['o&m rm'],
      propAm: ['property am'], propRm: ['property rm'], grTeam: ['gr team'], teamResp: ['team responsibility'], cabType: ['cabinet type'],
      cabModel: ['cabinet model'], asp: ['asp'], bsc: ['bsc'], rnc: ['rnc'], city: ['city'], siteAddr: ['site address'], tenant: ['tenant site code'],
      onAir: ['on air date'], annDate: ['announcement date'], huawei: ['huawei swapped (yes/no)'], outage: ['outage'], alarm: ['alarm'], note2: ['comments'],
      code3g: ['3g code'], codeU900: ['u900 code'] } },
    { sheet: /^bts-db$/i, key: ['site'], cols: {
      st2g: ['2g status'], bsc: [/^bsc/], rnc: ['rnc name'], nm2g: ['site name', 1], nm3g: ['3g site name'], nm4g: ['site name', 2],
      code3g: ['3g code'], codeU900: ['u900 code'], code4g: ['4g code'], sev2g: ['sevirity'], sev3g: ['3g severiy'], sev4g: ['4g severiy'],
      region: ['region'], subRegion: ['sub region'], subType: ['sub. and type'], special: ['special sites'], asp: ['flm asp'], btsAddr: ['address'] } },
    { sheet: /^zain new sites subcontractor$/i, key: ['site id'], cols: { powerSc: ['power sc'] } },
    { sheet: /^sheet7$/i, key: ['new site id'], dates: ['billable'], cols: {
      oldId: ['old site id'], city: ['city'], rmResp: ['rm responsible'], omCat: ['o&m category'], billable: ['billable date'], siteStatus: ['site status'],
      gens: ['no of gens'], cpConn: ['cp connected or not'], cpLegal: ['cp legal or illegal'], addr7: ['address'] } },
    { sheet: /^sheet1$/i, key: ['site id'], cols: { tower: ['site type'] } },
  ];
  const EMPTY_X = /^(|-|0|null|n\/a|#n\/a|0&)$/i;

  function headerIndex(head, spec) {
    const [m, nth = 1] = spec; let seen = 0;
    for (let i = 0; i < head.length; i++) {
      if (m instanceof RegExp ? m.test(head[i]) : head[i] === m) { if (++seen === nth) return i; }
    }
    return -1;
  }

  function readExtras(XLSX, wb, toRows, warnings) {
    const byId = new Map();
    for (const def of EXTRA_SHEETS) {
      const sn = wb.SheetNames.find(n => def.sheet.test(n.trim()));
      if (!sn) continue;
      const d = toRows(sn);
      if (!d.length) continue;
      const head = d[0].map(norm);
      const k = headerIndex(head, def.key);
      if (k < 0) continue;
      const cols = Object.entries(def.cols).map(([f, spec]) => [f, headerIndex(head, spec)]).filter(([, i]) => i >= 0);
      for (let r = 1; r < d.length; r++) {
        const row = d[r];
        if (!row || row[k] == null) continue;
        const id = String(row[k]).trim().replace(/\.0+$/, '');
        if (!id) continue;
        const x = byId.get(id) || {};
        for (const [f, i] of cols) {
          if (f in x) continue;                       // الأولوية للمصدر الأول
          let v = row[i];
          v = (def.dates || []).includes(f) ? dateVal(v) : (typeof v === 'number' ? String(v) : clean(v));
          if (v == null || EMPTY_X.test(String(v).trim())) continue;
          x[f] = String(v).trim();
        }
        byId.set(id, x);
      }
    }
    return byId;
  }

  /** XLSX = SheetJS lib, wb = workbook. Returns {rows, warnings, sheet} */
  function parseWorkbook(XLSX, wb) {
    const warnings = [];
    const find = pred => wb.SheetNames.find(pred);
    let name = find(n => /الجدول العام|ألجدول العام/.test(n));
    const toRows = n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null });
    let data = null, hi = -1;
    const tryName = n => {
      const d = toRows(n);
      for (let i = 0; i < Math.min(d.length, 15); i++) {
        if (d[i] && d[i].some(c => norm(c) === 'site id')) { data = d; hi = i; return true; }
      }
      return false;
    };
    if (!(name && tryName(name))) {
      name = null;
      for (const n of wb.SheetNames) { if (tryName(n)) { name = n; break; } }
    }
    if (!data) throw new Error('لم أجد جدولاً فيه عمود "Site ID" في الملف.');
    const head = data[hi].map(norm);
    const idx = {};
    head.forEach((h, i) => { if (COLMAP[h] && !(COLMAP[h] in idx)) idx[COLMAP[h]] = i; });

    // cluster lookup sheet (ورقة1): [site id, supervisor]
    const cmap = {};
    const cn = find(n => n.trim() === 'ورقة1');
    if (cn) toRows(cn).slice(1).forEach(r => { if (r && r[0] != null && r[1]) cmap[String(r[0]).trim()] = clean(r[1]); });

    const extras = readExtras(XLSX, wb, toRows, warnings);
    const rows = [], seen = new Set();
    let noId = 0, dup = 0, withExtra = 0;
    for (let r = hi + 1; r < data.length; r++) {
      const row = data[r];
      if (!row) continue;
      const rawId = row[idx.id];
      if (rawId == null || String(rawId).trim() === '') { if (row.some(c => c != null)) noId++; continue; }
      const id = String(rawId).trim().replace(/\.0+$/, '');
      if (seen.has(id)) { dup++; continue; }
      seen.add(id);
      const o = { id };
      for (const k in idx) {
        if (k === 'id') continue;
        const v = row[idx[k]];
        let out;
        if (DATE_KEYS.includes(k)) out = dateVal(v);
        else if (PHONE_KEYS.includes(k)) out = phoneVal(v);
        else if (k === 'st') out = siteType(v);
        else if (k === 'lon' || k === 'lat') { const n = Number(v); out = (v != null && isFinite(n) && n !== 0) ? n : ''; }
        else if (k === 'as') { const n = Number(v); out = isFinite(n) && v != null ? n : ''; }
        else out = clean(v);
        if (out !== '' && out != null) o[k] = out;
      }
      if (!o.cl && cmap[id]) o.cl = cmap[id];
      if (o.sev) o.sev = o.sev.toUpperCase();
      const x = extras.get(id);
      if (x && Object.keys(x).length) { o.x = x; withExtra++; }
      rows.push(o);
    }
    if (noId) warnings.push(noId + ' صف بدون رقم موقع تم تجاهله');
    if (dup) warnings.push(dup + ' رقم موقع مكرر (تم الاحتفاظ بالأول)');
    const miss = rows.filter(r => !r.cl).length;
    if (miss) warnings.push(miss + ' موقع بدون اسم مشرف (Cluster)');
    return { rows, warnings, sheet: name };
  }

  // ---------- crypto ----------
  const enc = new TextEncoder(), dec = new TextDecoder();
  const OPEN = 'bot-rm::open';
  const pass = code => (code && String(code).trim()) ? 'bot-rm::' + String(code).trim() : OPEN;
  const subtle = () => (root.crypto && root.crypto.subtle) || require('node:crypto').webcrypto.subtle;
  const rnd = n => (root.crypto && root.crypto.getRandomValues ? root.crypto.getRandomValues(new Uint8Array(n)) : require('node:crypto').webcrypto.getRandomValues(new Uint8Array(n)));
  function b64e(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  function b64d(b) { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  async function key(code, salt) {
    const base = await subtle().importKey('raw', enc.encode(pass(code)), 'PBKDF2', false, ['deriveKey']);
    return subtle().deriveKey({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function gz(u8, mode) {
    const S = mode === 'z' ? CompressionStream : DecompressionStream;
    const st = new Blob([u8]).stream().pipeThrough(new S('gzip'));
    return new Uint8Array(await new Response(st).arrayBuffer());
  }
  async function seal(rows, code) {
    const salt = rnd(16), iv = rnd(12);
    const k = await key(code, salt);
    const plain = await gz(enc.encode(JSON.stringify(rows)), 'z');
    const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, k, plain));
    return { v: 1, updated: new Date().toISOString(), count: rows.length, locked: !!(code && String(code).trim()), salt: b64e(salt), iv: b64e(iv), ct: b64e(ct) };
  }
  async function open(pkt, code) {
    const k = await key(code, b64d(pkt.salt));
    const plain = await subtle().decrypt({ name: 'AES-GCM', iv: b64d(pkt.iv) }, k, b64d(pkt.ct));
    return JSON.parse(dec.decode(await gz(new Uint8Array(plain), 'u')));
  }

  const api = { parseWorkbook, seal, open, b64e, b64d };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BotCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
