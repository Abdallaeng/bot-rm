# Bot Rm — البحث برقم الموقع

موقع ثابت (PWA) يعمل كتطبيق هاتف. لا يحتاج سيرفر ولا بناء (build).

## النشر على GitHub Pages (مجاني)
1. أنشئ مستودعاً جديداً على GitHub باسم `bot-rm` (Public).
2. ارفع **كل** محتويات هذا المجلد إلى جذر المستودع (Add file ← Upload files).
3. Settings ← Pages ← Source: *Deploy from a branch* ← Branch: `main` / `(root)` ← Save.
4. بعد دقيقة يصبح الرابط: `https://USERNAME.github.io/bot-rm/`

## النشر على Cloudflare Pages (مجاني)
Workers & Pages ← Create ← Pages ← Connect to Git ← اختر المستودع ←
Framework: None، Build command: فارغ، Output directory: `/` ← Save and Deploy.

## تثبيته كتطبيق
- أندرويد (Chrome): ⋮ ← «تثبيت التطبيق».
- آيفون (Safari): مشاركة ← «إضافة إلى الشاشة الرئيسية».

## الدخول
- الدخول مباشر بدون رمز (يمكن تفعيل رمز من الإدارة ← تحديث البيانات)
- الإدارة: المستخدم `Admin` / كلمة المرور `Admin1234`

## تحديث البيانات
الإدارة ← تحديث البيانات ← ارفع ملف الإكسل ← «نشر على GitHub» (بعد إدخال التوكن في الإعدادات)،
أو «تنزيل data.json» واستبدل الملف في المستودع يدوياً.

ملاحظة: الموقع مفتوح للعامة، فأي شخص يستطيع قراءة `data.json`. لحمايته ضع رمز فريق عند رفع التحديث (تشفير AES-256).

## هيكل الكود

```
index.html            الهيكل + مشهد الأبراج (SVG)
config.js / core.js   الإعدادات + قراءة الإكسل والتشفير (مشترك مع سكربت البناء)
css/                  tokens (الألوان) · base · scene · search · card · admin
js/main.js            نقطة الدخول
js/lib/               dom · storage · text · labels  (أدوات صغيرة)
js/data/              store (تحميل/فهرسة) · analytics (العدّاد)
js/ui/                search · card · home · effects · admin (يُحمَّل عند الطلب)
sw.js                 الخدمة للعمل دون اتصال (الشبكة أولاً)
```

## النشر من لوحة الإدارة (لكل المستخدمين)

زر «نشر للجميع» يرسل البيانات إلى `functions/api/publish.js` (Cloudflare Pages Function) التي تحفظها في KV،
و`functions/data.json.js` يخدم النسخة الأحدث. يتطلب ربط KV namespace باسم `DATA` بالمشروع مرة واحدة:
Cloudflare ← Workers & Pages ← KV ← Create namespace ← ثم المشروع ← Settings ← Bindings ← KV namespace ← Variable name = `DATA`.

## تتبّع الاستخدام والبث (Functions + KV)
- `POST /api/track` يجمّع عمليات البحث يومياً في KV (يتطلب ربط KV باسم `DATA`).
- `GET /api/stats` (إدارة) تقارير كل المستخدمين، و`/api/broadcast` + `/api/bhist` لإعلانات البث.
- ملاحظة: KV المجاني يسمح بنحو 1000 كتابة يومياً؛ الأجهزة ترسل دفعات كل دقيقة تقريباً لتقليل الكتابات.
