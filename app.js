/* Bot Rm — الواجهة */
(function () {
  'use strict';
  const CFG = window.BOTRM, Core = window.BotCore;
  const $ = s => document.querySelector(s);
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const GOV = { Karbala: 'كربلاء', Babil: 'بابل', Baghdad: 'بغداد', Najaf: 'النجف', Qaddissiya: 'القادسية', Wassit: 'واسط', Muthanna: 'المثنى', 'Thi Qar': 'ذي قار', Basra: 'البصرة', Anbar: 'الأنبار', Diwaniyah: 'الديوانية' };
  const IO = { Indoor: 'داخلي (Indoor)', Outdoor: 'خارجي (Outdoor)', 'Small cell': 'Small cell' };
  const AR_DIGITS = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9, '۰': 0, '۱': 1, '۲': 2, '۳': 3, '۴': 4, '۵': 5, '۶': 6, '۷': 7, '۸': 8, '۹': 9 };
  const latin = s => String(s).replace(/[٠-٩۰-۹]/g, d => AR_DIGITS[d]);
  const normAr = s => latin(s).toLowerCase().replace(/[ً-ٰٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();

  let ROWS = [], BY = new Map(), META = {}, CODE = LS.get('brm_code', '');
  let lastTracked = '', timer = null;

  const toast = (() => { let t; return m => { const e = $('#toast'); e.textContent = m; e.classList.add('on'); clearTimeout(t); t = setTimeout(() => e.classList.remove('on'), 2200); }; })();
  async function copy(txt) { try { await navigator.clipboard.writeText(txt); toast('تم النسخ'); } catch (e) { toast('تعذّر النسخ'); } }

  /* ---------------- تحميل البيانات ---------------- */
  async function fetchPacket() {
    const r = await fetch(CFG.dataFile + '?t=' + Date.now(), { cache: 'no-cache' });
    if (!r.ok) throw new Error('data ' + r.status);
    return r.json();
  }
  function setRows(rows, meta) {
    ROWS = rows; META = meta || {};
    BY = new Map(rows.map(r => [r.id, r]));
    ROWS.forEach(r => { r._s = normAr([r.nm, r.mn, r.cl, GOV[r.gov] || r.gov, r.gov].filter(Boolean).join(' ')); });
  }
  async function unlock(pkt, code) { return Core.open(pkt, code); }
  async function boot() {
    renderShell();
    let pkt;
    try { pkt = await fetchPacket(); LS.set('brm_pkt_meta', { updated: pkt.updated }); }
    catch (e) { return fatal('تعذّر تحميل البيانات. تأكد من الاتصال بالإنترنت ثم أعد المحاولة.'); }
    const tries = [CODE, ''];
    for (const c of tries) {
      try { const rows = await unlock(pkt, c); CODE = c; return ready(rows, pkt); } catch (e) {}
    }
    gate(pkt);
  }
  function fatal(msg) { $('#main').innerHTML = `<div class="gate"><div class="card"><h2>⚠️</h2><p>${esc(msg)}</p><button class="btn pri" onclick="location.reload()">إعادة المحاولة</button></div></div>`; }
  function gate(pkt, wrong) {
    $('#main').innerHTML = `<div class="gate"><div class="card"><h2>🔒 رمز الدخول</h2><p>هذا الموقع محمي. أدخل رمز الفريق للمتابعة (مرة واحدة فقط على هذا الجهاز).</p>
      <form id="gf"><input class="inp" id="gc" type="password" autocomplete="off" placeholder="الرمز" autofocus><button class="btn pri" style="width:100%;justify-content:center;height:46px">دخول</button><div class="err" id="ge">${wrong ? 'الرمز غير صحيح' : ''}</div></form></div></div>`;
    $('#gf').onsubmit = async e => {
      e.preventDefault();
      const c = $('#gc').value.trim();
      try { const rows = await unlock(pkt, c); CODE = c; LS.set('brm_code', c); location.reload(); }
      catch (x) { $('#ge').textContent = 'الرمز غير صحيح'; $('#gc').select(); }
    };
  }
  function renderShell() { /* الهيكل موجود في index.html */ }

  function ready(rows, pkt) {
    setRows(rows, pkt);
    flushPending();
    const q = $('#q');
    q.disabled = false;
    $('#meta').innerHTML = `<span class="chip">عدد المواقع <b>${rows.length.toLocaleString('en')}</b></span>` + (pkt.updated ? `<span class="chip">آخر تحديث <b>${fmtDate(pkt.updated)}</b></span>` : '');
    $('#foot').textContent = 'Bot Rm · للاستخدام الداخلي';
    renderRecent();
    q.addEventListener('input', onInput);
    $('#form').addEventListener('submit', e => { e.preventDefault(); clearTimeout(timer); run(true); q.blur(); });
    $('#clr').onclick = () => { q.value = ''; onInput(); q.focus(); };
    q.focus({ preventScroll: true });
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash) { q.value = hash; onInput(); }
  }
  const fmtDate = iso => { try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (e) { return ''; } };

  /* ---------------- البحث ---------------- */
  function onInput() {
    const q = $('#q'); $('#clr').hidden = !q.value;
    run(false);
    clearTimeout(timer);
    timer = setTimeout(() => run(true), 900);
  }
  function currentQuery() { return latin($('#q').value).trim(); }
  let lastResultCount = 0, lastFound = false, shownId = null;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (RM) { const sc = document.getElementById('scene'); sc && sc.pauseAnimations && sc.pauseAnimations(); }
  function ping() {
    if (RM) return;
    const sc = document.getElementById('scene'); if (!sc) return;
    sc.classList.remove('ping'); void sc.getBoundingClientRect(); sc.classList.add('ping');
    const el = document.querySelector('.id-n'); if (!el) return;
    const fin = el.textContent; let n = 0;
    const iv = setInterval(() => {
      n++; if (n > 9) { el.textContent = fin; clearInterval(iv); return; }
      el.textContent = fin.replace(/\d/g, () => Math.floor(Math.random() * 10));
    }, 45);
  }
  function run(commit) {
    const raw = currentQuery(), out = $('#out');
    document.body.classList.toggle('has-result', !!raw);
    $('#meta').style.display = raw ? 'none' : ''; $('#recent').style.display = raw ? 'none' : '';
    if (!raw) { out.innerHTML = ''; lastFound = false; shownId = null; history.replaceState(null, '', location.pathname); return; }
    history.replaceState(null, '', '#' + encodeURIComponent(raw));
    if (/^\d+$/.test(raw)) {
      const id = String(parseInt(raw, 10));
      const hit = BY.get(raw) || BY.get(id);
      const sim = ROWS.filter(r => r.id !== (hit && hit.id) && r.id.startsWith(raw)).slice(0, 8);
      if (hit) { out.innerHTML = card(hit) + simHtml(sim); wire(hit); if (shownId !== hit.id) { shownId = hit.id; ping(); } }
      else if (sim.length) { out.innerHTML = `<div class="notfound"><b>لا يوجد موقع بالرقم ${esc(raw)}</b>هل تقصد أحد هذه؟</div>` + simHtml(sim, true); wire(); }
      else out.innerHTML = `<div class="notfound"><b>لا يوجد موقع بالرقم ${esc(raw)}</b>تأكد من الرقم وأعد المحاولة.</div>`;
      lastFound = !!hit; lastResultCount = hit ? 1 : 0;
    } else {
      const toks = normAr(raw).split(' ').filter(Boolean);
      const res = ROWS.filter(r => toks.every(t => r._s.includes(t))).slice(0, 30);
      if (res.length) {
        out.innerHTML = `<div class="list">${res.map(r => `<button class="li" data-id="${esc(r.id)}"><span class="n">${esc(r.id)}</span><span class="t">${esc(r.nm || '—')}<br><span class="g">${esc(GOV[r.gov] || r.gov || '')}${r.cl ? ' · ' + esc(r.cl) : ''}</span></span></button>`).join('')}</div>`;
        wire();
      } else out.innerHTML = `<div class="notfound"><b>لا توجد نتائج</b>جرّب رقم الموقع أو جزءاً من العنوان.</div>`;
      lastFound = res.length > 0; lastResultCount = res.length;
    }
    if (commit) track(raw, lastFound);
  }
  function simHtml(sim, only) {
    if (!sim.length) return '';
    return `<div class="simi"><small>${only ? '' : 'مواقع مشابهة'}</small><div>${sim.map(r => `<button class="chip" data-id="${esc(r.id)}">${esc(r.id)}</button>`).join('')}</div></div>`;
  }
  function wire(hit) {
    document.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { $('#q').value = b.dataset.id; onInput(); clearTimeout(timer); run(true); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    if (!hit) return;
    const sh = $('#shareBtn'); if (sh) sh.onclick = () => share(hit);
    const cp = $('#copyBtn'); if (cp) cp.onclick = () => copy(plainText(hit));
  }

  /* ---------------- بطاقة التفاصيل ---------------- */
  function phonesOf(v) {
    if (!v) return [];
    return String(v).split(/\s*[-–—+،,\/]\s*|\s{2,}/).map(s => s.trim()).filter(Boolean);
  }
  const isPhone = s => (s.replace(/\D/g, '').length >= 7) && /^[\d\s+]+$/.test(s);
  function wa(num) { let d = num.replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '964' + d.slice(1); else if (d.length === 10 && d[0] === '7') d = '964' + d; return 'https://wa.me/' + d; }
  const IC = {
    call: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l1.7-5A9 9 0 1 1 8 19.3z"/><path d="M9 10c0 3 2 5 5 5l1.5-1.5-2-1-1 .8c-1-.4-1.800-1.200-2.200-2.200l.8-1-1-2z"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-6.200 7-12a7 7 0 1 0-14 0c0 5.800 7 12 7 12z"/><circle cx="12" cy="10" r="2.500"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.600 13.500 6.800 4M15.400 6.500l-6.800 4"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>'
  };
  function phoneBlock(v) {
    const parts = phonesOf(v);
    if (!parts.length) return '<span class="muted">—</span>';
    return '<div class="phones">' + parts.map(p => isPhone(p)
      ? `<div class="ph"><a class="num" href="tel:${esc(p.replace(/\s/g, ''))}">${esc(p)}</a><a class="mini" href="tel:${esc(p.replace(/\s/g, ''))}" aria-label="اتصال">${IC.call}</a><a class="mini wa" href="${wa(p)}" target="_blank" rel="noopener" aria-label="واتساب">${IC.wa}</a></div>`
      : `<div class="muted">${esc(p)}</div>`).join('') + '</div>';
  }
  const fld = (l, v, full, raw) => (v === '' || v == null) ? '' : `<div class="f${full ? ' full' : ''}"><label>${l}</label><div>${raw ? v : esc(v)}</div></div>`;
  const dstr = s => /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('/') : s;
  function mapUrl(r) { return `https://www.google.com/maps?q=${r.lat},${r.lon}`; }
  function card(r) {
    const sevc = r.sev ? r.sev.toLowerCase() : '';
    const hasGeo = r.lat && r.lon;
    const dates = [['تاريخ الإعلان', r.ad], ['إعلان Hybrid', r.ah], ['إعلان Normal', r.an]].filter(x => x[1]).map(x => fld(x[0], dstr(x[1]), false, false)).join('');
    return `<article class="card${sevc ? ' sev-' + sevc : ''}">
      <div class="head"><div><div class="id">رقم الموقع</div><div class="id-n">${esc(r.id)}</div>
        <div class="badges">${r.sev ? `<span class="bd ${sevc}">${esc(r.sev)}</span>` : ''}${r.st ? `<span class="bd">${esc(r.st)}</span>` : ''}${r.ven ? `<span class="bd">${esc(r.ven)}</span>` : ''}${r.gov ? `<span class="bd" style="direction:rtl">${esc(GOV[r.gov] || r.gov)}</span>` : ''}</div></div>
        <div class="acts">${hasGeo ? `<a class="btn pri" href="${mapUrl(r)}" target="_blank" rel="noopener">${IC.map}الخريطة</a>` : ''}<button class="btn" id="shareBtn" type="button">${IC.share}مشاركة</button><button class="btn ghost" id="copyBtn" type="button">${IC.copy}نسخ</button></div></div>
      <div class="cluster ${r.cl ? '' : 'none'}"><span class="av">${r.cl ? esc(r.cl.replace(/^حجي\s*/, '').charAt(0) || '؟') : '؟'}</span><div><small>المشرف · Cluster</small><b>${r.cl ? esc(r.cl) : 'غير محدد في الملف'}</b></div></div>
      <div class="sec"><h3>الموقع</h3><div class="grid">
        ${fld('اسم / عنوان الموقع', r.nm, true)}
        ${fld('المحافظة', GOV[r.gov] || r.gov)}${fld('نوع الموقع', IO[r.io] || r.io)}
        ${fld('التصنيف', r.t2, false, false).replace('<div>', '<div class="en">')}${fld('المواقع المرتبطة', r.as != null ? r.as : '')}
        ${hasGeo ? fld('الإحداثيات', `<span class="en">${r.lat}, ${r.lon}</span>`, true, true) : ''}
      </div></div>
      <div class="sec"><h3>الفريق</h3><div class="grid">${fld('المقاول الفرعي', r.sub, false, false).replace('<div>', '<div class="en">')}${fld('المورّد', r.ven, false, false).replace('<div>', '<div class="en">')}</div></div>
      <div class="sec"><h3>جهات الاتصال</h3><div class="grid">
        ${fld('المسؤول عن الموقع', r.mn)}${fld('رقم المسؤول', phoneBlock(r.mp), true, true)}
        ${r.inv ? fld('رقم الفاتورة', phoneBlock(r.inv), true, true) : ''}${r.own ? fld('رقم صاحب الموقع', phoneBlock(r.own), true, true) : ''}
      </div></div>
      ${dates ? `<div class="sec"><h3>الإعلان</h3><div class="grid">${dates}</div></div>` : ''}
      ${r.cm ? `<div class="sec"><h3>ملاحظات</h3><div class="grid">${fld('', r.cm, true)}</div></div>` : ''}
    </article>`;
  }
  function plainText(r) {
    const L = [`📍 موقع ${r.id}`, r.nm, `المحافظة: ${GOV[r.gov] || r.gov || '-'}`, `Severity: ${r.sev || '-'}  |  ${r.st || ''}`, r.cl ? `المشرف: ${r.cl}` : '', r.mn ? `المسؤول: ${r.mn}` : '', r.mp ? `رقم المسؤول: ${r.mp}` : '', r.inv ? `رقم الفاتورة: ${r.inv}` : '', r.own ? `رقم صاحب الموقع: ${r.own}` : '', r.lat && r.lon ? mapUrl(r) : ''];
    return L.filter(Boolean).join('\n');
  }
  async function share(r) {
    const text = plainText(r);
    if (navigator.share) { try { await navigator.share({ title: 'موقع ' + r.id, text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    copy(text);
  }

  /* ---------------- الأخيرة + السجل المحلي ---------------- */
  function renderRecent() {
    const log = LS.get('brm_log', []), seen = [];
    for (let i = log.length - 1; i >= 0 && seen.length < 8; i--) if (log[i][2] && !seen.includes(log[i][1])) seen.push(log[i][1]);
    $('#recent').innerHTML = seen.length ? `<small>آخر ما بحثت عنه</small><div class="meta" style="margin:0">${seen.map(s => `<button class="chip" data-id="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : '';
    document.querySelectorAll('#recent [data-id]').forEach(b => b.onclick = () => { $('#q').value = b.dataset.id; onInput(); clearTimeout(timer); run(true); });
  }

  /* ---------------- العدّاد الأونلاين ---------------- */
  const ymd = (d = new Date()) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const API = 'https://api.counterapi.dev/v1/' + CFG.counterNs + '/';
  async function hit(key) {
    const r = await fetch(API + key + '/up', { mode: 'cors' });
    if (!r.ok) throw new Error('hit ' + r.status);
    return (await r.json()).count;
  }
  async function getCount(key) {
    const r = await fetch(API + key, { mode: 'cors' });
    if (r.status === 404 || r.status === 400) return 0;
    if (!r.ok) throw new Error('get ' + r.status);
    const j = await r.json(); return Number(j.count) || 0;
  }
  function track(q, found) {
    if (q === lastTracked + '|' + found) return;
    lastTracked = q + '|' + found;
    const log = LS.get('brm_log', []);
    log.push([Date.now(), q, found ? 1 : 0]);
    LS.set('brm_log', log.slice(-600));
    const day = ymd(), keys = ['s' + day]; if (!found) keys.push('m' + day);
    keys.forEach(k => hit(k).catch(() => { const p = LS.get('brm_pending', []); p.push(k); LS.set('brm_pending', p.slice(-300)); }));
    renderRecent();
  }
  async function flushPending() {
    const p = LS.get('brm_pending', []); if (!p.length) return;
    LS.set('brm_pending', []);
    for (const k of p) { try { await hit(k); } catch (e) { const n = LS.get('brm_pending', []); n.push(k); LS.set('brm_pending', n); break; } }
  }

  /* ---------------- لوحة الإدارة ---------------- */
  const sha = async s => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))).map(b => b.toString(16).padStart(2, '0')).join('');
  const isAdmin = () => { try { return sessionStorage.getItem('brm_admin') === '1'; } catch (e) { return false; } };
  const dlg = $('#dlg');
  $('#adminBtn').onclick = () => { openDlg(); isAdmin() ? panel() : login(); };
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  function openDlg() { if (!dlg.open) dlg.showModal(); }
  const closeBtn = '<button class="btn ghost" type="button" onclick="document.getElementById(\'dlg\').close()" aria-label="إغلاق">✕</button>';
  function login(err) {
    dlg.style.width = 'min(400px,calc(100vw - 20px))';
    dlg.innerHTML = `<div class="dh"><b>🔐 دخول الإدارة</b>${closeBtn}</div><div class="db"><form class="form" id="lf" autocomplete="off">
      <div><label>اسم المستخدم</label><input class="inp ltr" id="lu" autocapitalize="off" autocomplete="username" required></div>
      <div><label>كلمة المرور</label><input class="inp ltr" id="lp" type="password" autocomplete="current-password" required></div>
      <button class="btn pri" style="justify-content:center;height:46px">دخول</button><div class="err" id="le">${err || ''}</div></form></div>`;
    setTimeout(() => $('#lu') && $('#lu').focus(), 50);
    $('#lf').onsubmit = async e => {
      e.preventDefault();
      const h = await sha($('#lu').value.trim().toLowerCase() + ':' + $('#lp').value);
      if (h === CFG.adminHash) { try { sessionStorage.setItem('brm_admin', '1'); } catch (x) {} panel(); }
      else { $('#le').textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة'; }
    };
  }
  let tab = 'rep';
  function panel() {
    dlg.style.width = '';
    dlg.innerHTML = `<div class="dh"><b>⚙️ لوحة الإدارة</b><div style="display:flex;gap:8px"><button class="btn ghost" id="lo" type="button">خروج</button>${closeBtn}</div></div>
      <div class="tabs"><button class="tab" data-t="rep">📊 التقارير</button><button class="tab" data-t="upd">⬆️ تحديث البيانات</button><button class="tab" data-t="set">🔧 الإعدادات</button></div><div class="db" id="tb"></div>`;
    $('#lo').onclick = () => { try { sessionStorage.removeItem('brm_admin'); } catch (e) {} dlg.close(); };
    dlg.querySelectorAll('.tab').forEach(b => b.onclick = () => { tab = b.dataset.t; showTab(); });
    showTab();
  }
  function showTab() {
    dlg.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    ({ rep: tabReports, upd: tabUpdate, set: tabSettings })[tab]($('#tb'));
  }

  /* ----- التقارير ----- */
  async function tabReports(el) {
    el.innerHTML = '<div class="note">جارٍ تحميل التقارير…</div>';
    const days = []; for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ k: ymd(d), d }); }
    const log = LS.get('brm_log', []);
    const localBy = {}; log.forEach(l => { const k = ymd(new Date(l[0])); (localBy[k] = localBy[k] || [0, 0]); localBy[k][0]++; if (!l[2]) localBy[k][1]++; });
    let online = true;
    const res = await Promise.all(days.map(async x => {
      try { const [s, m] = await Promise.all([getCount('s' + x.k), getCount('m' + x.k)]); return { ...x, s, m }; }
      catch (e) { online = false; const l = localBy[x.k] || [0, 0]; return { ...x, s: l[0], m: l[1] }; }
    }));
    if (!online) res.forEach(x => { const l = localBy[x.k] || [0, 0]; x.s = l[0]; x.m = l[1]; });
    const sum = (a, n) => a.slice(-n).reduce((t, x) => t + x.s, 0);
    const today = res[res.length - 1], y = res[res.length - 2];
    const max = Math.max(1, ...res.map(x => x.s));
    const W = 560, H = 190, bw = W / res.length;
    const bars = res.map((x, i) => {
      const h = Math.round((x.s / max) * (H - 50)), bx = i * bw + bw * .17, w = bw * .66, by = H - 24 - h;
      return `<g><rect x="${bx.toFixed(1)}" y="${by}" width="${w.toFixed(1)}" height="${Math.max(h, 2)}" rx="5" fill="${i === res.length - 1 ? 'var(--acc)' : 'color-mix(in srgb,var(--acc) 45%,transparent)'}"/><text class="val" x="${(bx + w / 2).toFixed(1)}" y="${by - 5}" text-anchor="middle">${x.s || ''}</text><text x="${(bx + w / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${String(x.d.getDate()).padStart(2, '0')}/${String(x.d.getMonth() + 1).padStart(2, '0')}</text></g>`;
    }).join('');
    const logRev = log.slice().reverse();
    const cnt = {}; log.forEach(l => { if (l[2]) cnt[l[1]] = (cnt[l[1]] || 0) + 1; });
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const topMax = top.length ? top[0][1] : 1;
    const gv = {}; ROWS.forEach(r => { const g = GOV[r.gov] || r.gov || 'غير محدد'; gv[g] = (gv[g] || 0) + 1; });
    const gvl = Object.entries(gv).sort((a, b) => b[1] - a[1]); const gm = gvl[0] ? gvl[0][1] : 1;
    el.innerHTML = `${online ? '' : '<div class="note warn">⚠️ تعذّر الوصول لخدمة العدّاد الأونلاين، الأرقام أدناه من هذا الجهاز فقط.</div>'}
      <div class="kpis"><div class="kpi acc"><small>بحث اليوم</small><b>${today.s}</b></div><div class="kpi"><small>أمس</small><b>${y.s}</b></div><div class="kpi"><small>آخر 7 أيام</small><b>${sum(res, 7)}</b></div><div class="kpi"><small>آخر 14 يوم</small><b>${sum(res, 14)}</b></div><div class="kpi bad"><small>بدون نتيجة (اليوم)</small><b>${today.m}</b></div></div>
      <div class="h4">عدد عمليات البحث يومياً ${online ? '(أونلاين — كل المستخدمين)' : '(هذا الجهاز)'}</div>
      <div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="عدد عمليات البحث اليومية">${bars}</svg></div>
      ${top.length ? `<div class="h4">الأكثر بحثاً (على هذا الجهاز)</div>${top.map(t => `<div class="bar"><span class="en" style="direction:ltr;text-align:start">${esc(t[0])}</span><i style="width:${Math.round(t[1] / topMax * 100)}%"></i><em>${t[1]}</em></div>`).join('')}` : ''}
      <div class="h4">توزيع المواقع حسب المحافظة</div>${gvl.map(t => `<div class="bar"><span>${esc(t[0])}</span><i style="width:${Math.round(t[1] / gm * 100)}%"></i><em>${t[1]}</em></div>`).join('')}
      <div class="h4">آخر عمليات البحث (على هذا الجهاز)</div>
      ${logRev.length ? `<table class="tbl"><tr><th>الوقت</th><th>البحث</th><th>النتيجة</th></tr>${logRev.slice(0, 12).map(l => `<tr><td>${new Date(l[0]).toLocaleString('en-GB', { hour12: false, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td><td style="direction:ltr;text-align:start">${esc(l[1])}</td><td>${l[2] ? '✅' : '❌'}</td></tr>`).join('')}</table>` : '<div class="muted">لا توجد عمليات بعد.</div>'}`;
  }

  /* ----- تحديث البيانات ----- */
  const GH = () => Object.assign(guessGh(), LS.get('brm_gh', {}));
  function guessGh() {
    const h = location.hostname, seg = location.pathname.split('/')[1] || '';
    if (/\.github\.io$/.test(h)) return { owner: h.split('.')[0], repo: seg || (h.split('.')[0] + '.github.io'), branch: 'main', path: 'data.json', token: '' };
    return { owner: '', repo: '', branch: 'main', path: 'data.json', token: '' };
  }
  let staged = null;
  function tabUpdate(el) {
    const gh = GH(), canPush = gh.owner && gh.repo && gh.token;
    el.innerHTML = `<div class="note">ارفع ملف الإكسل الجديد (نفس الشكل: ورقة <b>الجدول العام</b>). سيتم فحصه ومقارنته بالبيانات الحالية قبل النشر.</div>
      <label class="drop" id="dz"><input type="file" id="fi" accept=".xlsx,.xlsm,.xls" hidden><b>اضغط لاختيار الملف أو اسحبه هنا</b>Excel (.xlsx)</label>
      <div id="prev"></div>`;
    const fi = $('#fi'), dz = $('#dz');
    fi.onchange = () => fi.files[0] && handleFile(fi.files[0]);
    ['dragover', 'dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('on'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('on'); }));
    dz.addEventListener('drop', e => e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]));
    if (staged) showStaged();
  }
  function ensureXlsx() {
    return new Promise((res, rej) => {
      if (window.XLSX) return res();
      const s = document.createElement('script'); s.src = 'xlsx.mini.min.js'; s.onload = res; s.onerror = () => rej(new Error('تعذّر تحميل مكتبة Excel')); document.head.appendChild(s);
    });
  }
  async function handleFile(f) {
    const pv = $('#prev'); pv.innerHTML = '<div class="note">جارٍ قراءة الملف…</div>';
    try {
      await ensureXlsx();
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellFormula: false, cellStyles: false, cellNF: false, sheetStubs: false });
      const r = Core.parseWorkbook(XLSX, wb);
      if (!r.rows.length) throw new Error('لا توجد صفوف صالحة.');
      const old = new Map(ROWS.map(x => { const c = Object.assign({}, x); delete c._s; return [x.id, JSON.stringify(c)]; }));
      let add = 0, chg = 0, same = 0; const seen = new Set();
      r.rows.forEach(x => { seen.add(x.id); if (!old.has(x.id)) add++; else if (old.get(x.id) !== JSON.stringify(x)) chg++; else same++; });
      let rem = 0; old.forEach((v, k) => { if (!seen.has(k)) rem++; });
      staged = { rows: r.rows, warnings: r.warnings, sheet: r.sheet, name: f.name, add, chg, same, rem };
      showStaged();
    } catch (e) { pv.innerHTML = `<div class="note warn">❌ ${esc(e.message || e)}</div>`; }
  }
  function showStaged() {
    const s = staged, gh = GH(), canPush = gh.owner && gh.repo && gh.token, pv = $('#prev');
    pv.innerHTML = `<div class="sp"></div><div class="kpis"><div class="kpi acc"><small>إجمالي المواقع</small><b>${s.rows.length}</b></div><div class="kpi"><small>جديدة</small><b>${s.add}</b></div><div class="kpi"><small>معدّلة</small><b>${s.chg}</b></div><div class="kpi bad"><small>محذوفة</small><b>${s.rem}</b></div></div>
      <div class="note">الملف: <b class="en">${esc(s.name)}</b> · الورقة: <b>${esc(s.sheet)}</b> · بدون تغيير: ${s.same}</div>
      ${s.warnings.length ? `<div class="note warn">${s.warnings.map(esc).join('<br>')}</div>` : ''}
      <div class="form"><div><label>رمز دخول الفريق (اتركه فارغاً لجعل الموقع مفتوحاً للجميع بدون رمز)</label><input class="inp ltr" id="nc" value="${esc(CODE)}" placeholder="بدون رمز"></div>
      <div class="row"><button class="btn pri" id="pub" style="justify-content:center;height:46px" ${canPush ? '' : 'disabled'}>🚀 نشر على GitHub</button><button class="btn" id="dl" style="justify-content:center;height:46px">⬇️ تنزيل data.json</button></div>
      ${canPush ? '' : '<div class="muted" style="font-size:13px">لتفعيل «النشر المباشر» أدخل بيانات GitHub في تبويب الإعدادات. أو نزّل الملف وارفعه يدوياً إلى المستودع.</div>'}
      <div class="err" id="ue"></div><div id="um"></div></div>`;
    const build = async () => { const c = $('#nc').value.trim(); const pkt = await Core.seal(s.rows, c); return { pkt, c }; };
    $('#dl').onclick = async () => {
      const { pkt, c } = await build();
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(pkt)], { type: 'application/json' })); a.download = 'data.json'; a.click();
      $('#um').innerHTML = `<div class="note">تم التنزيل. استبدل ملف <b>data.json</b> في المستودع بهذا الملف ثم احفظ (Commit).${c ? '' : ' (الموقع بدون رمز)'}</div>`;
    };
    $('#pub').onclick = async () => {
      const b = $('#pub'); b.disabled = true; $('#ue').textContent = ''; $('#um').innerHTML = '<div class="note">جارٍ النشر…</div>';
      try {
        const { pkt, c } = await build();
        await ghPut(JSON.stringify(pkt), `تحديث البيانات (${s.rows.length} موقع)`);
        CODE = c; LS.set('brm_code', c); setRows(s.rows, pkt);
        $('#meta').innerHTML = `<span class="chip">عدد المواقع <b>${s.rows.length}</b></span><span class="chip">آخر تحديث <b>${fmtDate(pkt.updated)}</b></span>`;
        $('#um').innerHTML = '<div class="note">✅ تم النشر. سيظهر التحديث للجميع خلال دقيقة تقريباً (بعد أن يعيد الاستضافة بناء الموقع).</div>';
        staged = null;
      } catch (e) { $('#um').innerHTML = ''; $('#ue').textContent = '❌ ' + (e.message || e); b.disabled = false; }
    };
  }
  async function ghPut(content, msg) {
    const gh = GH(), url = `https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/${gh.path}`;
    const H = { Authorization: 'Bearer ' + gh.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    let sha;
    const g = await fetch(url + '?ref=' + encodeURIComponent(gh.branch), { headers: H });
    if (g.ok) sha = (await g.json()).sha; else if (g.status !== 404) throw new Error(g.status === 401 ? 'التوكن غير صالح (401)' : g.status === 403 ? 'التوكن لا يملك صلاحية (403)' : 'GitHub ' + g.status);
    const p = await fetch(url, { method: 'PUT', headers: H, body: JSON.stringify({ message: msg, content: btoa(content), branch: gh.branch, sha }) });
    if (!p.ok) { let m = ''; try { m = (await p.json()).message; } catch (e) {} throw new Error('فشل النشر (' + p.status + ') ' + (m || '')); }
  }

  /* ----- الإعدادات ----- */
  function tabSettings(el) {
    const gh = GH();
    el.innerHTML = `<div class="note">هذه الإعدادات تُحفظ على جهازك فقط. تُستخدم لزر «نشر على GitHub» حتى يصل التحديث لكل المستخدمين.</div>
      <form class="form" id="sf"><div class="row"><div><label>حساب GitHub (Owner)</label><input class="inp ltr" id="go" value="${esc(gh.owner)}" placeholder="username"></div><div><label>اسم المستودع (Repo)</label><input class="inp ltr" id="gr" value="${esc(gh.repo)}" placeholder="bot-rm"></div></div>
      <div class="row"><div><label>الفرع (Branch)</label><input class="inp ltr" id="gb" value="${esc(gh.branch)}"></div><div><label>مسار الملف</label><input class="inp ltr" id="gp" value="${esc(gh.path)}"></div></div>
      <div><label>GitHub Token (صلاحية Contents: Read and write لهذا المستودع فقط)</label><input class="inp ltr" id="gt" type="password" value="${esc(gh.token)}" placeholder="github_pat_…"></div>
      <div class="row"><button class="btn pri" style="justify-content:center;height:46px">حفظ</button><button class="btn" id="clrlog" type="button" style="justify-content:center;height:46px">مسح سجل هذا الجهاز</button></div></form>
      <div class="sp"></div><details><summary>كيف أنشئ التوكن؟</summary><ol style="line-height:1.9;margin:10px 0 0;padding-inline-start:20px"><li>GitHub ← Settings ← Developer settings ← Fine-grained tokens ← Generate new token</li><li>Repository access: اختر مستودع Bot Rm فقط</li><li>Permissions ← Contents: <b>Read and write</b></li><li>انسخ التوكن والصقه هنا (لا تشاركه مع أحد)</li></ol></details>
      <div class="h4">الإصدار</div><div class="muted en" style="direction:ltr;text-align:start">Bot Rm · data: ${esc(META.updated || '')}</div>`;
    $('#sf').onsubmit = e => { e.preventDefault(); LS.set('brm_gh', { owner: $('#go').value.trim(), repo: $('#gr').value.trim(), branch: $('#gb').value.trim() || 'main', path: $('#gp').value.trim() || 'data.json', token: $('#gt').value.trim() }); toast('تم الحفظ'); };
    $('#clrlog').onclick = () => { LS.del('brm_log'); renderRecent(); toast('تم المسح'); };
  }

  /* ---------------- تشغيل ---------------- */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  boot();
})();
