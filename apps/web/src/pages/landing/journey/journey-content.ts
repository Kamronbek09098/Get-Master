import { t } from '@/i18n';

export type JourneyRole = 'customer' | 'master';

export type SceneId =
  | 'problem'
  | 'describe'
  | 'match'
  | 'compare'
  | 'profile'
  | 'job'
  | 'result'
  | 'work'
  | 'request'
  | 'offer'
  | 'accepted'
  | 'reputation'
  | 'earnings';

export interface JourneyScene {
  id: SceneId;
  kicker: string;
  title: string;
  text: string;
}

export const CUSTOMER_SCENES: JourneyScene[] = [
  { id: 'problem', kicker: t('Muammo'), title: t('Biror narsa buzildi.'), text: t('Kran oqadi, rozetka uchqun chiqaradi, konditsioner jim. Har kuni — yangi muammo.') },
  { id: 'describe', kicker: t('Tasvirlash'), title: t('Muammoingizni ayting.'), text: t('Matn yozing, rasmga yoki videoga oling, ovoz yozing. Qaysi biri qulay bo‘lsa.') },
  { id: 'match', kicker: t('Moslash'), title: t('Yaqin ustalar topiladi.'), text: t('So‘rov yaqin atrofdagi, tasdiqlangan va mos tajribali ustalarga boradi.') },
  { id: 'compare', kicker: t('Solishtirish'), title: t('Takliflarni yonma-yon ko‘ring.'), text: t('Narx, reyting, bajarilgan ishlar, javob tezligi — hammasi bir joyda.') },
  { id: 'profile', kicker: t('Usta'), title: t('Kim kelishini oldindan biling.'), text: t('Tasdiq, tajriba, portfolio va haqiqiy sharhlar — profil usta haqida hamma narsani aytadi.') },
  { id: 'job', kicker: t('Ish'), title: t('Har qadam ko‘rinib turadi.'), text: t('So‘rovdan yakungacha: usta qayerda, nima qilyapti — real vaqtda.') },
  { id: 'result', kicker: t('Natija'), title: t('Oldin va keyin — isbot bilan'), text: t('Usta ish oldidan va keyin suratga oladi. Siz tasdiqlagach to‘lov o‘tadi, kafolat boshlanadi.') },
];

export const MASTER_SCENES: JourneyScene[] = [
  { id: 'work', kicker: t('Ish'), title: t('Siz o‘z ishingizning ustasisiz.'), text: t('Asboblar, qo‘llar, tajriba. GetMaster sizga mijozni topib beradi — ishni siz qilasiz.') },
  { id: 'request', kicker: t('So‘rov'), title: t('Yangi ish so‘rovi keladi.'), text: t('Xizmat, muammo, joy va qulay vaqt — taklif berishdan oldin hammasini ko‘rasiz.') },
  { id: 'offer', kicker: t('Taklif'), title: t('Narxni o‘zingiz qo‘yasiz.'), text: t('Narx, kelish vaqti, qisqa xabar — va taklif mijozga ketdi.') },
  { id: 'accepted', kicker: t('Buyurtma'), title: t('Mijoz sizni tanladi.'), text: t('Buyurtma tasdiqlandi. Manzil, vaqt va aloqa — hammasi tayyor.') },
  { id: 'job', kicker: t('Yo‘l'), title: t('Ish bosqichma-bosqich'), text: t('Yo‘lda, yetib keldi, ishlayapti, tugadi — mijoz har bosqichni ko‘radi, siz esa ishonch qozonasiz.') },
  { id: 'result', kicker: t('Natija'), title: t('Ishingiz o‘zi gapiradi.'), text: t('Oldin va keyin suratlari portfolioga qo‘shiladi — keyingi mijozlar uchun dalil.') },
  { id: 'reputation', kicker: t('Obro‘'), title: t('Har ish — obro‘ga aylanadi.'), text: t('Reyting, sharhlar, tasdiq belgisi va javob tezligi sizni topiladigan ustaga aylantiradi.') },
  { id: 'earnings', kicker: t('Daromad'), title: t('Daromad shaffof'), text: t('Bajarilgan ishlar, joriy buyurtmalar va tushum — bitta professional panelda.') },
];

export const JOURNEY_COPY = {
  customer: {
    label: t('Mijoz yo‘li'),
    tagline: [t('Muammongiz'), t('To‘g‘ri usta'), t('Bitta joyda')],
    cta: t('So‘rov yaratish'),
  },
  master: {
    label: t('Usta yo‘li'),
    tagline: [t('Ajoyib ishlang'), t('Topiling'), t('Obro‘ quring')],
    cta: t('Usta bo‘lish'),
  },
} as const;
