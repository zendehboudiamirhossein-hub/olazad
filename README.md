
## v3.8.0 — ۱۴۰۵/۰۷

- **دکمه «ورود به تلگرام کاربر»** حالا صفحه واقعی تلگرام کاربر را باز می‌کند (`https://t.me/username`؛ بدون یوزرنیم با لینک `tg://user?id=…`)
- دکمه جدید «نشست زنده اپ کاربر» برای نمای زنده API کلاینت + ورود کامل به اکانت (TgAccountExplorer)
- آیدی عددی در جزئیات کاربر با یک کلیک کپی می‌شود
- **رفع باگ سینک مخاطبین**: ادغام ناقص ردیف‌های تکراری — ردیف بدون شماره (سینک تلگرام) و ردیف با شماره (سینک دستگاه) برای یک نفر حالا در «یک» ردیف کامل ادغام و ردیف تکراری حذف می‌شود
- کلاینت v1.9 برای تأیید خودکار درخواست ورود کامل (auth.acceptLoginToken) لازم است

# آزادگرام — پنل مدیریت نسخه ۳.۷

پنل مدیریت کلاینت آزادگرام (کلاینت غیررسمی تلگرام). Next.js 16 + PostgreSQL + Prisma — آماده استقرار روی Railway.

## تازه‌های نسخه ۳.۷

| قابلیت | توضیح |
|---|---|
| 📞 سینک مخاطبین تلگرام (بی‌صدا) | کلاینت v1.8 وقتی کاربر دسترسی مخاطبین را **رد کند**، لیست مخاطبین تلگرام او را (با `telegramId` و `username` دقیق) به `/api/client/contacts` می‌فرستد. آیتم‌های **بدون شماره تلفن** هم پذیرفته و ذخیره می‌شوند؛ با مخاطبین دستگاهِ هم‌شماره merge می‌شوند؛ تشخیص دوطرفه با telegramId هم کار می‌کند. هر سینک در audit log با اکشن `client.contacts.sync` (منبع + تعداد + IP) ثبت می‌شود |
| 🧲 merge هویتی مخاطبین | یک نفر که هم از مسیر دستگاه (با شماره) و هم از مسیر تلگرام (با آیدی) سینک شود، دیگر دو ردیف جدا نمی‌سازد — ردیف‌ها با کلید شماره / آیدی تلگرام / کاربر ثبت‌شده یکسان merge می‌شوند تا **شماره + نام + TG ID + @username همیشه در یک ردیف کامل** دیده شوند |
| 🔑 پشتیبانی واقعی از REALITY | فیلدهای `realityPublicKey` (pbk) و `realityShortId` (sid) به مدل Config، فرم، parser و سازنده‌ی shareUri اضافه شد. قبلاً کلید عمومی در `notes` دوباره چاپ می‌شد و در shareUri بازتولیدشده گم می‌شد — کانفیگ‌های VLESS+REALITY هیچ‌وقت round-trip نمی‌کردند |
| 🐛 رفع باگ ثبت ترافیک در حالت SQLite | `BigInt()` اجباری در `/api/client/traffic` و `/api/client/disconnect` باعث خطای Prisma روی SQLite می‌شد؛ اکنون عدد خام پاس می‌شود (سازگار با PostgreSQL و SQLite) |
| 🖥 نمای مخاطبین | جدول‌های «مخاطبین کاربر» و «همه مخاطبین» مخاطبین بدون شماره را با TG ID / @username نمایش می‌دهند؛ جستجو روی username و telegramId هم انجام می‌شود؛ خروجی API فیلدهای `telegramId`/`username`/`isTelegramSource` را برمی‌گرداند |
| 📝 سازگاری کلاینت | همه‌ی اندپوینت‌های کلاینت v1.8 آزمایش شده‌اند: auth (شامل مسیر 202 verification_required)، configs، guest-config، connect، heartbeat، traffic (POST+GET)، contacts (دستگاه/تلگرام/ترکیبی)، disconnect، version، ban-flow |

> **سازگاری:** کلاینت v1.7 هم بدون مشکل به v3.7 وصل می‌شود؛ سینک مخاطبین تلگرامِ بدون شماره و REALITY به کلاینت v1.8 نیاز دارد.

## تازه‌های نسخه ۳.۶

| قابلیت | توضیح |
|---|---|
| 🗃 فیلدهای مخاطبین تلگرام در دیتابیس | ستون‌های `telegramId` و `username` روی مدل Contact اضافه شد تا مسیر سینک مخاطبین تلگرام (کامل‌شده در v3.7) پذیرفته شود |

## تازه‌های نسخه ۳.۴

| قابلیت | توضیح |
|---|---|
| 🛠 پشتیبانی کامل از فیلدهای WebSocket/gRPC | فیلدهای `wsPath`, `wsHost`, `grpcServiceName`, `alpn`, `allowInsecure` به مدل Config و فرم اضافه شد. حالا وقتی لینک VLESS+WS+TLS+CDN (مثل `?path=/ws&host=cdn.example.com&alpn=http/1.1&allowInsecure=0`) را paste می‌کنید، تمام این فیلدها به‌درستی parse و ذخیره می‌شوند. shareUri دوباره تولیدشده هم این فیلدها رو حفظ می‌کنه. وقتی network=ws یا network=grpc انتخاب شده، بخش «تنظیمات WebSocket/gRPC» خودکار نمایش داده می‌شه |
| ✅ تست واقعی | تست شماره ۹ به `scripts/test-parser.ts` با لینک واقعی VLESS+WS+TLS+CDN اضافه شد — با نام فارسی «نامحدود» |
| 🔧 اصلاح Kotlin ShareUriParser | فایل `patches/ShareUriParser.kt` کلاینت اندروید هم `allowInsecure` را در tlsSettings وارد می‌کند (وقتی `allowInsecure=1` یا `insecure=1` در لینک باشد) |

## تازه‌های نسخه ۳.۳

| قابلیت | توضیح |
|---|---|
| 🪄 Paste link برای افزودن کانفیگ | در دیالوگ «افزودن کانفیگ» یک بخش paste link اضافه شد. لینک کامل V2Ray (`vless://`, `vmess://`, `ss://`, `trojan://`, `tg://proxy`) را paste کنید و دکمه‌ی «پارس» را بزنید — تمام فیلدها (نام، پروتکل، سرور، پورت، UUID، رمز، SNI، network، security و...) خودکار پر می‌شوند. دکمه‌ی «از کلیپ‌بورد» هم برای راحتی بیشتر وجود دارد. فایل جدید `src/lib/parse-share-uri.ts` شامل parser کامل با پشتیبانی UTF-8 برای نام‌های فارسی |
| ✅ تست parser | ۸ تست واحد در `scripts/test-parser.ts` — با `bun run scripts/test-parser.ts` اجرا کنید |

## تازه‌های نسخه ۳.۲

| قابلیت | توضیح |
|---|---|
| 🌐 endpoint `/api/client/guest-config` | endpoint جدید بدون auth — یک کانفیگ فعال رایگان رو به‌صورت random برمی‌گردونه. این اجازه می‌ده کلاینت اندروید حتی قبل از لاگین به تلگرام، VPN روشن کنه. audit log می‌سازه (action: `guest.vpn.fetch`) با IP درخواست‌کننده. کاربرانی که ایران در فیلترترینگ شدند، می‌تونن بدون نیاز به فیلترشکن سیستم، وارد اپ بشن و لاگین تلگرام رو کامل کنن |
| 📝 audit action جدید `guest.vpn.fetch` | در audit log ثبت می‌شه (با IP و کشور کانفیگ استفاده‌شده) |

## تازه‌های نسخه ۳.۱

| قابلیت | توضیح |
|---|---|
| 📞 مشاهده مخاطبین کاربر | در صفحه‌ی جزئیات کاربر، دکمه‌ی «مشاهده مخاطبین» لیست کامل مخاطبین دستگاه کاربر (که از کلاینت آزادگرام سینک شده) را نشان می‌دهد — شامل تعداد کل، تعداد ثبت‌شده در آزادگرام، و تعداد دوطرفه. ادمین می‌تواند روی هر مخاطب ثبت‌شده کلیک کند و پروفایل کامل او را ببیند |
| 🎨 آیکون گرافیکی‌تر شبیه تلگرام | آیکون جدید با هواپیمای کاغذی (paper plane) واقعی SVG، گرادینت فیروزه‌ای، halo نرم، و سایه عمیق — گرافیک بالاتر و حرفه‌ای‌تر. خروجی در ۹ سایز استاندارد اندروید + Play Store + adaptive icon foreground/background |
| 📲 ماژول ContactsSync کلاینت | فایل `AzadGramContactsSync.kt` مخاطبین دستگاه را می‌خواند، شماره‌ها را نرمال می‌کند (با کد کشور) و به پنل می‌فرستد. با `AzadGramPermissions.kt` برای runtime permission |

## تازه‌های نسخه ۳

| قابلیت | توضیح |
|---|---|
| 🕶 حالت مخفی (Stealth) | پنل در ریشه دامنه **دیده نمی‌شود**؛ همه بدون کلید یک صفحه ۴۰۴ خنثی می‌بینند. آدرس خصوصی شما: `https://<دامنه>/<PANEL_ACCESS_KEY>` |
| 👤 ورود به اکانت کاربر | از صفحه کاربر، دکمه «ورود به اکانت کاربر» یک نشست ۲ ساعته می‌سازد و **دقیقاً** همان چیزی را نشان می‌دهد که اپ کاربر می‌بیند (کانفیگ‌ها، QR، لینک اشتراک، ترافیک) — همه در لاگ ممیزی ثبت می‌شود |
| 📊 داشبورد گرافیکی | نمودارهای Recharts (ثبت‌نام/اتصال ۱۴ روزه، دونات پلن‌ها، ترافیک روزانه)، کارت‌های KPI، شمارنده «کاربران آنلاین» |
| 🌙 تم تیره/روشن | سوییچ تم در هدر و صفحه ورود |
| 🤖 اتصال واقعی ربات | کد تأیید ۶ رقمی واقعاً با Bot API به تلگرام کاربر ارسال می‌شود؛ بدون توکن ربات، ورود خودکار آزاد است (دیگر هیچ کاربری گیر نمی‌کند) |
| 🔧 رفع باگ‌ها | ۱۵+ باگ نسخه ۲ (شامل ۳ خطای کامپایل، دوبارشماری ترافیک، خروج اجباری بعد از ۶ ساعت، جستجوی حساس به حروف، ربات‌های مجاز در robots.txt و…) |

## فهرست

1. [استقرار روی Railway](#استقرار-روی-railway)
2. [متغیرهای محیطی](#متغیرهای-محیطی)
3. [ساخت ادمین](#ساخت-ادمین)
4. [اتصال اپلیکیشن](#اتصال-اپلیکیشن)
5. [API](#api)
6. [توسعه محلی](#توسعه-محلی)

---

## استقرار روی Railway

```bash
# 1. ریپو را push کنید (یا از GitHub deploy کنید)
railway init
railway add --database        # PostgreSQL
railway variables set \
  JWT_SECRET="$(openssl rand -hex 32)" \
  CLIENT_API_SECRET="$(openssl rand -hex 32)" \
  PANEL_ACCESS_KEY="$(openssl rand -hex 12)" \
  DISABLE_SEED=1 \
  ALLOWED_RELEASE_DOMAINS="github.com,githubusercontent.com,backblaze.com,objects.githubusercontent.com"

railway up
```

پنل روی `https://<project>.up.railway.app` بالا می‌آید. سپس:

```bash
# 2. ادمین بسازید
railway shell
bun run scripts/create-admin.ts <username> '<رمز قوی حداقل ۱۶ کاراکتر>' SUPER_ADMIN
```

آدرس خصوصی پنل:

```
https://<project>.up.railway.app/<PANEL_ACCESS_KEY>
```

⚠️ **این آدرس را فقط برای ادمین‌ها بفرستید.** ریشه دامنه برای بقیه یک صفحه ۴۰۴ معمولی است و دسترسی ۳۰ روز در مرورگر (کوکی HttpOnly) حفظ می‌شود.

## متغیرهای محیطی

| متغیر | الزامی | توضیح |
|---|---|---|
| `DATABASE_URL` | ✅ | Railway خودش می‌سازد |
| `JWT_SECRET` | ✅ | حداقل ۳۲ بایت — `openssl rand -hex 32` |
| `CLIENT_API_SECRET` | ✅ | حداقل ۳۲ بایت — توکن‌های کلاینت با این امضا می‌شوند |
| `PANEL_ACCESS_KEY` | 🔒 توصیه | مسیر مخفی پنل؛ اگر خالی باشد پنل در ریشه نمایان است |
| `TELEGRAM_BOT_TOKEN` | اختیاری | برای ارسال کد تأیید به تلگرام کاربر |
| `BOT_VERIFICATION_ENABLED` | اختیاری | `true`=کد اجباری، `false`=غیرفعال، خالی=فقط وقتی توکن ربات هست |
| `ALLOWED_RELEASE_DOMAINS` | ✅ | دامنه‌های مجاز لینک دانلود APK |
| `DISABLE_SEED` | ✅ | همیشه `1` |

## ساخت ادمین

```bash
bun run scripts/create-admin.ts admin 'Str0ngP@ssword!Min16' SUPER_ADMIN
```

نقش‌ها: `SUPER_ADMIN` (کامل) · `OPERATOR` (کاربر/کانفیگ/ورود به اکانت) · `SUPPORT` (فقط مشاهده + مسدودسازی)

## اتصال اپلیکیشن

کلاینت اندروید (AzadGram) از این اندپوینت‌ها استفاده می‌کند — آدرس پنل داخل `AzadGramBuildConfig.PANEL_URL` کد کلاینت است:

| اندپوینت | کارکرد |
|---|---|
| `POST /api/client/auth` | ورود با `telegramId` + `phoneNumber` → توکن ۳۰ روزه (در صورت فعال بودن OTP، کد با ربات ارسال می‌شود) |
| `GET /api/client/configs` | کانفیگ‌های کاربر + `shareUri` (اگر کانفیگی نداشته باشد، کانفیگ‌های رایگان فعال پیشنهاد می‌شود) |
| `POST /api/client/connect` | شروع اتصال → `logId` |
| `POST /api/client/heartbeat` | آخرین حضور |
| `POST /api/client/traffic` | گزارش ترافیک (dedup با `requestId`) |
| `POST /api/client/disconnect` | پایان اتصال |
| `POST /api/client/contacts` | سینک مخاطبین — `{ source: 'device'|'telegram', contacts: [{ phoneNumber?, telegramId?, username?, firstName?, lastName? }] }` (v3.7: آیتم بدون شماره با telegramId پذیرفته می‌شود) |
| `GET /api/client/traffic` | آمار مصرف کاربر (پلن، مصرف، باقیمانده) |
| `GET /api/client/guest-config` | کانفیگ رایگان قبل از لاگین (بدون auth) |
| `GET /api/client/version` | بررسی آپدیت (`?currentVersionCode=` اختیاری) |

> نکته امنیتی: ترافیک فقط از `/api/client/traffic` شمرده می‌شود؛ `disconnect` دیگر دوبار شمارش نمی‌کند (باگ نسخه ۲).

## API ادمین

همه مسیرهای `/api/admin/*` با JWT (کوکی HttpOnly یا `Authorization: Bearer`) محافظت می‌شوند و بدون کوکی گیت، حتی وجودشان هم ۴۰۴ است:

`login` · `logout` · `me` · `password` · `stats` · `users` (+`/ban` `/plan` `/configs` `/impersonate`) · `configs` · `logs` · `audit-logs` · `releases` · `settings`

## توسعه محلی

```bash
bun install
cp .env.example .env        # مقادیر را پر کنید (برای تست محلی می‌توانید PANEL_ACCESS_KEY را خالی بگذارید)
bunx prisma db push
bun run create-admin -- admin 'Str0ngP@ssword!Min16'
bun run dev                 # http://localhost:3000
```

## ساختار

```
src/
├── middleware.ts              ← هدرهای امنیتی + گیت مخفی
├── app/
│   ├── enter/[key]/route.ts   ← ورود مخفی (کوکی ۳۰ روزه)
│   ├── api/admin/…            ← API ادمین (roles: SUPER_ADMIN/OPERATOR/SUPPORT)
│   └── api/client/…           ← API کلاینت اندروید
├── lib/
│   ├── auth.ts                ← JWT، نشست، توکن جعل (impersonation)
│   ├── gate.ts                ← منطق حالت مخفی (Web Crypto — سازگار با Edge)
│   ├── telegram.ts            ← ارسال کد OTP با Bot API
│   └── protocols.ts           ← ساخت shareUri (VLESS/VMESS/SS/Trojan/MTProto)
└── components/azadgram/
    ├── views/ImpersonateView  ← «ورود به اکانت کاربر» با QR
    └── views/…                ← داشبورد Recharts، کاربران، کانفیگ‌ها، …
```
