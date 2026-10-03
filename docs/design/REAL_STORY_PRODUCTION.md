# Haqiqiy xizmat chaqiruvi — ishlab chiqarish qo‘llanmasi

Bosh sahifaning kinematografik qismi **haqiqiy dunyodagi** xizmat chaqiruvini ko‘rsatadi (dastur interfeysini emas).
Skroll videoni boshqaradi: pastga — oldinga, yuqoriga — orqaga. Video fayllar qo‘yilishi bilan bu qism avtomatik hero'ga aylanadi;
fayllar bo‘lmaganda sahifa vaqtincha 3D zaxira «film»ni ko‘rsatadi.

> **Muhim:** ushbu loyihada haqiqiy lavhalar hali yo‘q. Ularni suratga olish (yoki litsenziyalash) kerak. Soxta/animatsiyalangan material ishlatilmaydi.

## Printsip: BITTA xizmat chaqiruvi = BITTA video
Bir hikoyada **bir xil** mijoz, **bir xil** usta, **bir xil** uy va **bir xil** muammo bo‘lishi shart.
Tasodifiy stock lavhalar (kulayotgan odamlar, tasodifiy asboblar, qo‘l siqish) **taqiqlanadi**.

## Fayllar
```
apps/web/public/media/stories/<id>/
  film.webm   film.mp4     # desktop (WebM avval)
  film-m.mp4               # telefon (≤ 720p)
  film.jpg                 # poster (birinchi kadr)
```
`<id>` qiymatlari: `konditsioner`, `santexnika`, `elektrik`, `maishiy-texnika`, `duradgor`, `tamirlash`.
Kamida bitta hikoyaning `film.mp4` fayli bo‘lsa — qism yoqiladi; bir nechta bo‘lsa, pastda hikoya tanlash paydo bo‘ladi.

## Skroll foizi → kadr (hamma hikoya uchun bir xil xronologiya)
| Foiz | Bosqich | Kadrlar |
| --- | --- | --- |
| 0 % | Muammo | Haqiqiy uy, mijoz muammoni payqaydi (masalan, konditsioner yonmaydi). Studiyaga o‘xshamasin |
| ~6–14 % | GetMaster ishga tushiruvchi | **Juda qisqa**: mijoz telefondan so‘rov yuboradi (1–2 soniya). Sahifa o‘zi kichik «So‘rov yuborildi» yorlig‘ini ko‘rsatadi |
| 15 % | Usta keladi | Bino, eshik oldi, asboblar, salomlashuv |
| 30 % | Tekshiruv | Mijoz muammoni tushuntiradi, usta so‘raydi va ko‘zdan kechiradi; qo‘llar, asboblar, o‘lchov |
| 50 % | Ta’mir boshlanadi | Uskuna ochiladi, nosoz qism topiladi va olib tashlanadi |
| 70 % | Ish davom etadi | Yangi/tuzatilgan qism o‘rnatiladi, sozlash |
| 85 % | Sinov | Tizim yoqiladi, tekshiriladi |
| 95 % | Natija | Ishlayapti: sovuq havo / chiroq yonadi / suv oqmaydi |
| 100 % | Mijoz | Tabiiy yengillik va rahmat; usta asboblarni yig‘adi va ketadi; eshik yopiladi. So‘ng GetMaster sokin belgi sifatida (video oxirida ~8 % «nafas olish») |

Sahifa matni (sarlavha/izoh) har hikoya uchun `src/pages/landing/story/stories.ts` da; kerak bo‘lsa tahrir qiling.

## Hikoyalar (1 tadan stsenariy)
- **konditsioner:** o‘chgan konditsioner → usta → ichki qism → nosoz detal → almashtirish → sinov → sovuq havo → mijoz.
- **santexnika:** oqayotgan quvur → usta → oqish joyini topish → ta’mir → suv sinovi → quruq ulanishlar → mijoz.
- **elektrik:** chiroq yonmaydi → usta → shit → nosozlik → ta’mir → kuchlanish → chiroqlar yonadi → mijoz.
- **maishiy-texnika:** kir yuvish mashinasi → diagnostika → detal → sinov sikli → ishlaydi → mijoz.
- **duradgor:** shikastlangan mebel → ko‘zdan kechirish → ta’mir → jilolash → yig‘ib tekshirish → chiroyli natija.
- **tamirlash:** ta’mirsiz xona → baholash → ish → o‘zgarish → tayyor xona → mijoz natijani ko‘radi.

## Operatorlik (kinematografiya)
Umumiy plan (muhit) → o‘rtacha plan (insoniy muloqot) → yaqin plan (qo‘llar, asboblar) → makro (detal). Tabiiy yorug‘lik, mayin kamera harakati,
kerak joyda kichik chuqurlik keskinligi. Haqiqiy lokatsiya. Haddan tashqari teatrallashgan o‘yin yo‘q: tomoshabin «bu menga ham bo‘lishi mumkin» deb his qilsin.

## Kodlash (silliq skroll uchun SHART: har kadr kalit kadr)
```bash
ID=konditsioner; OUT=apps/web/public/media/stories/$ID; mkdir -p $OUT
ffmpeg -i source.mp4 -vf "scale=1920:-2,fps=30" -c:v libx264 -g 1 -crf 23 -preset slow -an -movflags +faststart $OUT/film.mp4
ffmpeg -i source.mp4 -vf "scale=1920:-2,fps=30" -c:v libvpx-vp9 -g 1 -crf 34 -b:v 0 -an $OUT/film.webm
ffmpeg -i source.mp4 -vf "scale=720:-2,fps=24" -c:v libx264 -g 1 -crf 27 -preset slow -an -movflags +faststart $OUT/film-m.mp4
ffmpeg -i source.mp4 -frames:v 1 -vf "scale=1920:-2" $OUT/film.jpg
```
Tavsiya: 15–30 soniya, 1080p/30 fps. Hajmni nazorat qiling (har kadr kalit bo‘lgani uchun fayl kattaroq bo‘ladi: ~15–40 MB desktop, ≤ 12 MB telefon).

## Mijoz ilovasidagi tutashuv
Bajarilgan buyurtmalardagi «Ish hikoyasi» (`OrderStory`) haqiqiy ish suratlaridan (oldin / jarayon / keyin) tuziladi — ilova «xizmatni boshqarish»,
haqiqiy dunyo esa «xizmat tajribasi». Landing videosida esa dastur ekranlari asosiy qahramon emas.
