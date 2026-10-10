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
- رمز الفريق (أول مرة على كل جهاز): `BotRm2026`
- الإدارة: المستخدم `Admin` / كلمة المرور `Admin1234`

## تحديث البيانات
الإدارة ← تحديث البيانات ← ارفع ملف الإكسل ← «نشر على GitHub» (بعد إدخال التوكن في الإعدادات)،
أو «تنزيل data.json» واستبدل الملف في المستودع يدوياً.

البيانات في `data.json` مشفّرة (AES-256) برمز الفريق، فلا يقرأها أحد من المستودع العام بدون الرمز.
