# GetMaster kinematografik videosi (ixtiyoriy)

Bu papkaga haqiqiy ish videosini qo‘ysangiz, bosh sahifadagi «film» uni **skroll bilan boshqaradi**
(pastga skroll — oldinga, yuqoriga — orqaga). Fayl bo‘lmasa, sahifa o‘zining 3D sahnalari bilan ishlayveradi.

Kutilgan fayl nomlari (mijoz uchun `customer.*`, usta uchun `master.*`):

| Fayl | Vazifa |
| --- | --- |
| `customer.webm`, `customer.mp4` | Desktop video (WebM avval, MP4 zaxira) |
| `customer-m.mp4` | Telefon uchun yengil nusxa (≤ 720p) |
| `customer.jpg` | Poster (birinchi kadr) |

## Silliq surilishi uchun to‘g‘ri kodlash

Skroll-videoda har kadr «kalit kadr» (all-intra) bo‘lishi shart, aks holda orqaga surish qotadi:

```bash
# Desktop MP4 (H.264, har kadr kalit, ovozsiz)
ffmpeg -i source.mp4 -vf "scale=1920:-2,fps=30" -c:v libx264 -g 1 -crf 23 -preset slow -an -movflags +faststart customer.mp4
# WebM (VP9, har kadr kalit)
ffmpeg -i source.mp4 -vf "scale=1920:-2,fps=30" -c:v libvpx-vp9 -g 1 -crf 34 -b:v 0 -an customer.webm
# Telefon uchun yengil nusxa
ffmpeg -i source.mp4 -vf "scale=720:-2,fps=24" -c:v libx264 -g 1 -crf 27 -preset slow -an -movflags +faststart customer-m.mp4
# Poster
ffmpeg -i source.mp4 -frames:v 1 -vf "scale=1920:-2" customer.jpg
```

Tavsiya: 12–25 soniya, 1080p, 30 fps. Mazmuni: muammo → ish jarayoni → natija (oldin / jarayon / keyin).
Real, haqiqiy ustalar bilan olingan lavhalar ishlating (litsenziyasi aniq bo‘lsin).
