import { t } from '@/i18n';

export interface FilmScene {
  label: string;
  title: string;
  text: string;
}

/** Filmning 2–6-sahnalari matni (1-sahna — hero: sarlavha va CTA landing-content'dan olinadi). */
export function filmScenes(master: boolean): FilmScene[] {
  if (master) {
    return [
      { label: t('02 — So‘rov'), title: t('Sizga mos so‘rov keladi.'), text: t('Xizmat turi, hudud va bo‘sh vaqtingiz bo‘yicha — keraksiz xabarlarsiz.') },
      { label: t('03 — Taklif'), title: t('Narxni o‘zingiz belgilaysiz.'), text: t('Mijoz reyting, tajriba va narxingizni solishtirib, sizni tanlaydi.') },
      { label: t('04 — Ish'), title: t('Ishni bajarasiz.'), text: t('Yo‘lga chiqing, yetib keling, ish oldidan va keyin surat bilan hujjatlang.') },
      { label: t('05 — Natija'), title: t('Natija sizning obro‘ingiz.'), text: t('Tasdiqlangan ish reyting, sharh va portfolioga aylanadi; to‘lov hisobingizga tushadi.') },
      { label: t('06 — GetMaster'), title: t('GetMaster'), text: t('Mijoz qidirmang — ish sizni topsin.') },
    ];
  }
  return [
    { label: t('02 — Tushunish'), title: t('GetMaster tushunadi.'), text: t('Matn, foto, video yoki ovoz — tizim muammo kontekstini o‘zi yig‘adi.') },
    { label: t('03 — Moslik'), title: t('To‘g‘ri usta topiladi.'), text: t('Hudud, tajriba, reyting va bo‘sh vaqt hisobga olinadi. Takliflarni siz solishtirasiz.') },
    { label: t('04 — Ish'), title: t('Ish boshlanadi.'), text: t('Usta yo‘lga chiqadi, ish oldidan va keyin surat bilan hujjatlaydi.') },
    { label: t('05 — Natija'), title: t('Natija o‘zi gapiradi.'), text: t('Siz tasdiqlaysiz, to‘lov o‘tadi, kafolat boshlanadi.') },
    { label: t('06 — GetMaster'), title: t('GetMaster'), text: t('Muammodan natijagacha — bitta oqim.') },
  ];
}

export function filmLabels(master: boolean) {
  return {
    request: master ? t('Konditsionerga texnik xizmat') : t('Oshxonadagi kran oqyapti'),
    place: t('Chilonzor · 1.2 km · Bugun'),
    chips: [t('Santexnika'), t('3 ta foto'), t('Shoshilinch')],
    nodes: [
      { letter: 'A', rating: '4.9' },
      { letter: 'J', rating: '4.8' },
      { letter: 'S', rating: '4.7' },
      { letter: 'D', rating: '5.0' },
      { letter: 'M', rating: '4.6' },
      { letter: 'B', rating: '4.8' },
    ],
  };
}

export const SCENE_NAMES = () => [t('Muammo'), t('Tushunish'), t('Moslik'), t('Ish'), t('Natija'), t('GetMaster')];
