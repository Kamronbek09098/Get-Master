# GetMaster — Dizayn yo‘nalishi (Cinematic Work Platform)

> Markaziy metafora: **«REAL WORK IN MOTION»** — haqiqiy ish harakatda.
> Hikoya: MUAMMO → TUSHUNISH → MOSLIK → USTA → ISH → NATIJA → ISHONCH.

Bu hujjat `DESIGN_SYSTEM_V2.md` ni to‘ldiradi: u yerda mahsulot tamoyillari, bu yerda esa kinematografik tajriba, harakat tili va media strategiyasi.

## 1. Tajriba tamoyillari
1. **Skroll = rejissyor.** Skroll pozitsiyasi ma’noli kontentni (3D sahna, video, matn) boshqaradi; bezak uchun emas.
2. **Dalil bezakdan muhim.** Ishonch — tasdiq, real ish, vaqt, narx va natija bilan ko‘rsatiladi.
3. **Jarayon ko‘rinadi.** Moslash va buyurtma holatlari «tizim ishlayapti»ni ko‘rsatadi, spinner emas.
4. **Desktop va mobil — alohida kompozitsiya.** Umumiy til, turli o‘zaro ta’sir.
5. **Har bir animatsiyaning sababi bor:** o‘zgarish, jarayon, bog‘liqlik, chuqurlik yoki sabab-oqibat. Aks holda olib tashlanadi.

## 2. Axborot arxitekturasi (hozirgi marshrutlar bilan xaritalash)
| Maqsad | Mavjud marshrut | Holat |
| --- | --- | --- |
| Landing (kino) | `/` | **Amalga oshirildi** (ScrollFilm) |
| Mijoz ilovasi | `/mijozlar/*` | Buyurtma hikoyasi + moslash vizualizatsiyasi qo‘shildi |
| Usta ilovasi | `/ustalar/*` | Keyingi bosqich |
| Admin | `/admin/*` | Operatsion dizayn, keyingi bosqich |
| `/how-it-works`, `/work`, `/about` | yo‘q | Keyingi bosqich (kontent kerak) |

## 3. Haqiqiy xizmat chaqiruvi (asosiy kinematografik hikoya)
Asosiy hikoya **haqiqiy dunyoda** bo‘ladi: haqiqiy muammo → mijoz yordam so‘raydi (juda qisqa) → usta keladi → muloqot → tekshiruv → ta’mir → sinov → natija → mijoz reaksiyasi. Dastur interfeysi asosiy qahramon emas.
- Komponent: `pages/landing/story/RealStory.tsx` (skroll → `ScrollVideo`), 6 xil hikoya (`stories.ts`), 8 bosqichli xronologiya, hikoya tanlash, bosqich navigatsiyasi.
- Ishlab chiqarish va kodlash qo‘llanmasi: `REAL_STORY_PRODUCTION.md`.
- Video fayllar bo‘lmaganda **zaxira** sifatida quyidagi 3D «film» ko‘rsatiladi (abstrakt; haqiqiy lavhalar tayyor bo‘lgach almashtiriladi).

## 3b. Zaxira: 3D «film» (ScrollFilm) — sahnalar
`progress (0..1)` → bitta Three.js sahna + sarlavhalar + (ixtiyoriy) video `currentTime`.

| Oraliq | Sahna | Vizual |
| --- | --- | --- |
| 0.00–0.17 | **Muammo** | Singan tishli g‘ildirak, qizil ogohlantirish, uchqunlar. Hero sarlavha va CTA |
| 0.17–0.35 | **Tushunish** | So‘rov kartochkasi, skaner chizig‘i |
| 0.35–0.53 | **Moslik** | Ustalar tugunlari, ulanish chiziqlari, tanlangan usta |
| 0.53–0.73 | **Ish** | Kalit + g‘ildiraklar; aylanish skrollga bog‘liq |
| 0.73–0.88 | **Natija** | Butun g‘ildirak, muvaffaqiyat halqasi va belgisi |
| 0.88–1.00 | **GetMaster** | Katta so‘z belgisi + CTA |

Dvigatel: `film/FilmStage.ts` (sahna), `film/ScrollFilm.tsx` (GSAP ScrollTrigger progress, DOM sarlavhalar). React har kadrda qayta chizilmaydi.

## 4. Video strategiyasi
- `components/media/ScrollVideo.tsx` — haqiqiy skroll-boshqaruvli video: `scroll → progress → video.currentTime` (rAF + yumshatish).
- Fayllar `public/media/film/` (qo‘llanma: `README.md`): WebM + MP4, telefon uchun yengil nusxa, poster. Har kadr kalit kadr (`-g 1`).
- Yuklash: ko‘rinish maydoniga yaqinlashganda; uzoqlashganda `src` bo‘shatiladi.
- Video bo‘lmasa 3D sahna ishlayveradi; harakat kamaytirilgan bo‘lsa — statik ketma-ketlik.
- **Eslatma:** haqiqiy ish lavhalari loyihada hali yo‘q — ularni olish/litsenziyalash kontent vazifasi.

## 5. Mijoz tajribasi
- **Buyurtma hikoyasi** (`OrderStory`): muammo → mutaxassis → ishdan oldin → jarayon → natija (oldin/keyin taqqoslash) → tasdiq. Mavjud buyurtma va ish-isbotlaridan olinadi.
- **Moslash** (`MatchingViz`): so‘rov markazda, mezonlar (muammo, joylashuv, ko‘nikma, vaqt, reyting) birin-ketin yonadi; yakunda haqiqiy natija soni.
- Rejada: so‘rov yaratishni hikoya shaklida (Muammo nima? → Ko‘rsating → Qachon? → Tushunamiz → Qidiramiz → Topildi). Bu mavjud forma mantiqini qayta qadoqlashni talab qiladi.

## 6. Harakat tili
Tokenlar: `src/lib/motion/tokens.ts` (`EASE`, `DURATION`, `SCRUB_SMOOTHING`).
- `out` — sahna/bo‘lim kirishi; `standard` — holat o‘zgarishi; `in` — yopilish.
- Davomiylik: 90 / 160 / 260 / 480 / 900 ms.
- Skroll yumshatish: har kadrda 12% yaqinlashish.
- **Harakatni kamaytirish** hamma joyda hurmat qilinadi (kino → statik ro‘yxat, video → poster, hikoya boblari darrov ochiq).

## 7. Tipografiya va rang
- Sarlavha: **Manrope** (800, qattiq tracking), matn: **Inter**, yorliqlar/raqamlar: **JetBrains Mono** (katta harf, keng tracking).
- Rang: qorong‘i «siyoh» (`#060d2b`) + brend ko‘k, iliq oltin urg‘u; usta — zumrad, admin — indigo. Qorong‘i/yorug‘ tema `tokens.css` da.
- Gradient/shisha faqat ma’no bor joyda (3D sahna ustida o‘qiladigan matn uchun).

## 8. Samaradorlik
- 3D alohida chunk; `three` faqat landing'da. Sahna ko‘rinmaganda render to‘xtaydi.
- Telefonda: kamroq uchqun, DPR ≤ 1.25, `lowPower` rejimi.
- WebGL yo‘q → statik zaxira. Ctrl+F5 dan keyin birinchi yuklash: preloader (foiz hisoblagich) seansda bir marta.

## 9. Holatlar (loading / empty / error / success)
- Buyurtma hikoyasida har bob uchun «bo‘sh holat» loyihalangan (surat hali yo‘q).
- Moslashda: jarayon, natija bor, natija yo‘q — alohida matn va vizual.
- Rejada: offline, ruxsat yo‘q, to‘lov jarayoni uchun alohida holat ekranlari.

## 10. Keyingi bosqichlar (tartib bilan)
1. Haqiqiy ish videolari (muammo → jarayon → natija) olish va `public/media/film/` ga joylash.
2. So‘rov yaratish oqimini hikoya shaklida qayta qadoqlash.
3. Usta profili: portfolio/case-study (oldin → jarayon → keyin) va skroll-video.
4. Usta ish stoli (bugun / yangi so‘rovlar / joriy ish / daromad) — zich va tez.
5. Admin operatsion markaz.
6. Mobil: pastki navigatsiya, bottom-sheet, yopishqoq CTA.
7. `/how-it-works`, `/work`, `/about` sahifalari.
