import { AirVent, Droplets, Hammer, Lightbulb, Armchair, WashingMachine } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { t } from '@/i18n';

/**
 * Haqiqiy xizmat chaqiruvi (service call) hikoyalari. Har bir hikoya — BITTA mijoz, BITTA usta, BITTA joy va BITTA muammo.
 * Video fayllar: public/media/stories/<id>/film.{webm,mp4}, film-m.mp4, poster.jpg  (qo‘llanma: docs/design/REAL_STORY_PRODUCTION.md)
 * Skroll foizi → bosqich (chapter). `at` — bosqich boshlanadigan progress (0..1).
 */
export interface StoryChapter {
  at: number;
  label: string;
  title: string;
  text: string;
}

export interface StoryDef {
  id: string;
  label: string;
  icon: LucideIcon;
  chapters: StoryChapter[];
}

/** 8 bosqichli umumiy xronologiya: 0 muammo → 15 usta keladi → 30 tekshiruv → 50 ta’mir → 70 jarayon → 85 sinov → 95 natija → 100 mijoz. */
const AT = [0, 0.15, 0.3, 0.5, 0.7, 0.85, 0.95, 1] as const;
const LABELS = () => [t('Muammo'), t('Usta keladi'), t('Tekshiruv'), t('Ta’mir boshlanadi'), t('Ish davom etadi'), t('Sinov'), t('Natija'), t('Mijoz')];

function story(id: string, label: string, icon: LucideIcon, copy: Array<[string, string]>): StoryDef {
  const labels = LABELS();
  return { id, label, icon, chapters: copy.map(([title, text], i) => ({ at: AT[i]!, label: `${String(i + 1).padStart(2, '0')} — ${labels[i]}`, title, text })) };
}

export function buildStories(): StoryDef[] {
  return [
    story('konditsioner', t('Konditsioner'), AirVent, [
      [t('Konditsioner o‘chdi.'), t('Issiq kunda bir zumda hammasi to‘xtadi. Tugma bosilsa ham javob yo‘q.')],
      [t('Usta eshik oldida.'), t('Asboblar bilan keldi. Mijoz eshikni ochadi, ular salomlashadi.')],
      [t('Birinchi navbatda — tinglash'), t('Usta muammoni so‘raydi, mijoz ko‘rsatadi. Keyin diagnostika.')],
      [t('Ichki qismni ochadi.'), t('Nosoz qism topildi: uni ehtiyotkorlik bilan olib tashlaydi.')],
      [t('Yangi qism o‘rnatiladi.'), t('Har bir bog‘lanish tekshiriladi, sozlash davom etadi.')],
      [t('Sinov'), t('Tizim yoqiladi va ishlashi tekshiriladi.')],
      [t('Sovuq havo'), t('Muammo yo‘qoldi. Konditsioner yana ishlayapti.')],
      [t('Yengillik'), t('Mijoz tabassum qiladi, ustaga rahmat aytadi.')],
    ]),
    story('santexnika', t('Santexnika'), Droplets, [
      [t('Quvur oqyapti.'), t('Suv polga tomyapti. Har daqiqa zarar o‘sadi.')],
      [t('Usta yetib keldi.'), t('Eshik ochiladi, qisqa salomlashuv va ish joyiga yo‘l.')],
      [t('Oqish joyi topiladi.'), t('Usta tekshiradi, mijoz vaziyatni tushuntiradi.')],
      [t('Ta’mir boshlanadi.'), t('Suv o‘chiriladi, shikastlangan qism olib tashlanadi.')],
      [t('Quvur almashtiriladi.'), t('Yangi qism joyiga o‘rnatilib mahkamlanadi.')],
      [t('Suv sinovi.'), t('Suv ochiladi — hamma ulanish quruq.')],
      [t('Muammo hal bo‘ldi.'), t('Oqish to‘xtadi, joy tozalandi.')],
      [t('Yengil nafas'), t('Mijoz tinchlanadi va minnatdorchilik bildiradi.')],
    ]),
    story('elektrik', t('Elektrik'), Lightbulb, [
      [t('Chiroq yonmaydi.'), t('Bir zumda yorug‘lik o‘chdi. Uy qorong‘i.')],
      [t('Elektrik keladi.'), t('Asbob-uskunalari bilan kirib keladi.')],
      [t('Shitni tekshiradi.'), t('O‘lchov asboblari bilan nosozlikni qidiradi.')],
      [t('Nosozlik topildi.'), t('Shikastlangan ulanish ajratiladi.')],
      [t('Ta’mir davom etadi.'), t('Yangi ulanish va himoya o‘rnatiladi.')],
      [t('Tizim sinaladi.'), t('Kuchlanish tekshiriladi, shit yoqiladi.')],
      [t('Yorug‘lik qaytdi.'), t('Chiroqlar yonadi. Hammasi joyida.')],
      [t('Mijoz xotirjam.'), t('Rahmat aytadi — uy yana jonlandi.')],
    ]),
    story('maishiy-texnika', t('Maishiy texnika'), WashingMachine, [
      [t('Kir yuvish mashinasi ishlamayapti.'), t('Dastur tanlanadi, lekin mashina javob bermaydi.')],
      [t('Usta keldi.'), t('Mijoz ustani mashina oldiga boshlab boradi.')],
      [t('Diagnostika'), t('Usta ovozni tinglaydi, ichki qismni ko‘zdan kechiradi.')],
      [t('Qismni olib tashlaydi.'), t('Nosoz detal ajratiladi va almashtirishga tayyorlanadi.')],
      [t('Almashtirish'), t('Yangi detal o‘rnatiladi, mahkamlanadi.')],
      [t('Sinov sikli'), t('Mashina yoqiladi: sinov dasturi ishlaydi.')],
      [t('Ishlayapti.'), t('Baraban aylanadi, hammasi normal.')],
      [t('Mijoz xursand.'), t('Tabassum va minnatdorchilik')],
    ]),
    story('duradgor', t('Mebel va duradgorlik'), Hammer, [
      [t('Mebel shikastlangan.'), t('Eshik osilib qolgan, bo‘g‘in buzilgan.')],
      [t('Usta keldi.'), t('Mijoz shikastni ko‘rsatadi.')],
      [t('Ko‘zdan kechirish'), t('Usta o‘lchaydi va ta’mir yo‘lini tanlaydi.')],
      [t('Ta’mir boshlanadi.'), t('Eski mahkamlagichlar olinadi.')],
      [t('Tuzatish va jilolash'), t('Detal tiklanadi, sirt tekislanadi.')],
      [t('Yig‘ib tekshirish'), t('Eshik joyiga o‘rnatilib yopilib-ochib ko‘riladi.')],
      [t('Chiroyli natija'), t('Mebel yangidek')],
      [t('Mijoz mamnun.'), t('Natijaga qarab tabassum qiladi.')],
    ]),
    story('tamirlash', t('Ta’mirlash'), Armchair, [
      [t('Xona ta’mirsiz.'), t('Devorlar shikastlangan, joy tayyor emas.')],
      [t('Mutaxassis keldi.'), t('Mijoz bilan kelishib ishni boshlaydi.')],
      [t('Baholash'), t('Hajm o‘lchanadi, reja kelishiladi.')],
      [t('Ish boshlanadi.'), t('Sirt tayyorlanadi, himoya yopiladi.')],
      [t('O‘zgarish ko‘zga tashlanadi.'), t('Qatlam ortidan qatlam — xona yangilanadi.')],
      [t('Yakuniy tekshiruv'), t('Chiziqlar, burchaklar, tozalik ko‘riladi.')],
      [t('Tayyor xona'), t('Avval va keyin orasidagi farq aniq.')],
      [t('Mijoz natijani ko‘radi.'), t('Xonaga kirib, hayratlanadi.')],
    ]),
  ];
}
