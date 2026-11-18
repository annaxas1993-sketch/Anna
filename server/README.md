# TAXI LIDER — տեղական սերվեր և դիսպետչեր

Այս նախագիծը նախատեսված է անձնական Android հեռախոսում աշխատող Termux սերվերի համար։ Այն չի պահանջում Render։

## Termux սերվերի գործարկում

1. Տեղադրիր Termux-ում Node.js LTS, PostgreSQL և OpenSSL։
2. Պահիր այս `server` պանակը հեռախոսում։
3. Մի անգամ գործարկիր `bash termux-start.sh`։ Սկրիպտը ստեղծում է PostgreSQL տվյալների բազան, գաղտնի `.env` կարգավորումները և տեղադրում npm փաթեթները։
4. Հաջորդ գործարկումների համար նույն հրամանը մեկնարկում է սերվերը։
5. Ստուգիր՝ `http://127.0.0.1:3000/health`։ Պատասխանը պետք է պարունակի `ok:true`։

Վարորդի հավելվածը նույն հեռախոսի վրա լռելյայն միանում է `http://127.0.0.1:3000` հասցեին։ Դիսպետչերի հեռախոսը պետք է միանա նույն սերվերին հասանելի LAN կամ անվտանգ HTTPS թունելի հասցեով․ `127.0.0.1`-ը այլ հեռախոսի վրա չի մատնանշում սերվերի հեռախոսը։

Առաջին ադմինի հաշիվը ստեղծվում է `POST /api/setup/admin` հասցեով՝ `x-setup-key` վերնագրում `.env` ֆայլի `ADMIN_SETUP_KEY` արժեքը փոխանցելով։ Այդ բանալին գաղտնի պահիր։

## API-ի հիմնական ուղիներ

- `POST /api/auth/register` և `POST /api/auth/login`
- `GET /api/me`
- `PATCH /api/drivers/availability` և `POST /api/drivers/location`
- `GET /api/orders/available`, `GET /api/orders/mine`
- `POST /api/orders/:id/accept`, `POST /api/orders/:id/status`
- `POST /api/orders/:id/meter/update`
- `GET /api/admin/drivers`, `GET /api/admin/orders`
- `PATCH /api/admin/orders/:id/assign` և `POST /api/admin/orders/:id/dispatch`

Սերվերի կոդը ավտոմատ կերպով կիրառում է `server/db/schema.sql` սխեման մեկնարկի ժամանակ։ Տվյալների բազայի պահուստային պատճեններ պարբերաբար պահիր։
