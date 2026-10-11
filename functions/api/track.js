/** POST /api/track — يستقبل دفعة أحداث بحث من الأجهزة ويجمّعها يومياً في وثيقة واحدة في KV.
 *  الجسم: { d: معرّف الجهاز, e: [[وقت_ms, نص_البحث, وُجد(1/0), محافظة], ...] }
 *  تقليل الكتابة: وثيقة واحدة لكل يوم (الإحصاءات + آخر العمليات + علامة النسخ الاحتياطي) = كتابة واحدة لكل دفعة،
 *  وحدّ أدنى بين دفعتين من نفس الجهاز، والنسخ الاحتياطي لا يُكتب إلا عند تغيّر البيانات فعلاً. */
import { json, dayKey, hourOf, clean, bump, getAgg, dropAgg, memo } from '../_shared.js';

const AGG_TTL = 90 * 86400, MAX_EVENTS = 50, MAX_BODY = 20_000, MAX_RECENT = 40;
const MIN_GAP = 4 * 60e3;          // أقل فاصل بين دفعتين صغيرتين من نفس الجهاز
const SMALL = 10;                  // الدفعات الأكبر من هذا الحجم تُقبل دائماً
const seen = new Map();            // جهاز → آخر قبول (ذاكرة العملية، تمنع حتى قراءة KV)

export async function onRequestPost({ request, env }) {
  if (!env.DATA) return json({ error: 'not-configured' }, 501);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: 'too-large' }, 413);
  let body; try { body = JSON.parse(raw); } catch { return json({ error: 'bad-json' }, 400); }
  const dev = String(body.d || '').replace(/[^\w-]/g, '').slice(0, 12);
  const now = Date.now();
  const events = (Array.isArray(body.e) ? body.e : []).slice(0, MAX_EVENTS)
    .map(([t, q, f, g]) => ({ t: Math.min(now, Math.max(now - 2 * 86400e3, +t || now)), q: clean(q), f: f ? 1 : 0, g: clean(g).slice(0, 24) }))
    .filter((x) => x.q);
  if (!events.length || !dev) return json({ ok: true, n: 0 });

  // حدّ المعدّل: دفعة صغيرة بعد دفعة أخيرة قريبة ← نطلب من الجهاز الاحتفاظ بها (لا قراءة ولا كتابة)
  if (events.length < SMALL && now - (seen.get(dev) || 0) < MIN_GAP) {
    const wait = Math.ceil((MIN_GAP - (now - seen.get(dev))) / 1000);
    return json({ ok: false, retry: wait }, 429);
  }
  seen.set(dev, now);
  if (seen.size > 2000) seen.clear();

  const byDay = {};
  events.forEach((x) => (byDay[dayKey(x.t)] ||= []).push(x));
  const today = dayKey(now);
  for (const [day, list] of Object.entries(byDay)) {
    const key = `agg:${day}`;
    dropAgg(day);                                                   // قراءة طازجة قبل الدمج حتى لا نفقد أحداث عملية أخرى
    const agg = (await env.DATA.get(key, 'json')) || { s: 0, m: 0, u: {}, h: Array(24).fill(0), top: {}, miss: {}, gov: {}, r: [] };
    list.forEach((x) => {
      agg.s++; agg.h[hourOf(x.t)]++;
      if (x.f) bump(agg.top, x.q, 300); else { agg.m++; bump(agg.miss, x.q, 150); }
      if (x.g) bump((agg.gov ||= {}), x.g, 40);
    });
    if (Object.keys(agg.u).length < 3000 || agg.u[dev]) agg.u[dev] = 1;
    agg.r = list.map((x) => [x.t, x.q, x.f, dev.slice(0, 4)]).concat(agg.r || []).sort((a, b) => b[0] - a[0]).slice(0, MAX_RECENT);
    agg.w = (agg.w || 0) + 1;                                       // عدّاد كتابات التتبّع لهذا اليوم (يظهر في لوحة الإدارة)
    if (day === today && !agg.bk) { agg.bk = 1; await dailyBackup(env); }   // علامة اليوم داخل الوثيقة نفسها: لا مفتاح lastbak
    await env.DATA.put(key, JSON.stringify(agg), { expirationTtl: AGG_TTL });
  }
  return json({ ok: true, n: events.length });
}

/** نسخة احتياطية: مرة في اليوم كحد أقصى، ولا تُكتب إلا إذا تغيّرت البيانات منذ آخر نسخة. نحتفظ بآخر 14. */
async function dailyBackup(env) {
  const today = dayKey();
  const packet = await env.DATA.get('packet');
  if (!packet) return;
  let count = 0, updated = '';
  try { const p = JSON.parse(packet); count = p.count; updated = p.updated; } catch { return; }
  const log = (await env.DATA.get('blog', 'json')) || [];
  if (log[0] && log[0].updated === updated) return;                 // لا جديد: لا كتابة
  await env.DATA.put(`ver:b${today}`, packet);
  log.unshift({ id: `b${today}`, ts: Date.now(), count, updated, name: 'نسخة احتياطية يومية' });
  for (const old of log.splice(14)) await env.DATA.delete(`ver:${old.id}`);
  await env.DATA.put('blog', JSON.stringify(log));
}
