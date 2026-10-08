import { useState } from 'react';
import { Plus } from 'lucide-react';
import { SupportContacts } from './SupportContacts';
import { cx } from '@/lib/utils';
import { t } from '@/i18n';

interface Qa {
  q: () => string;
  a: () => string;
}

const CUSTOMER: Qa[] = [
  { q: () => t('Ustani qanday topaman?'), a: () => t('Kategoriya bo‘yicha katalogdan tanlaysiz yoki muammoingizni yozib so‘rov qoldirasiz. Tizim mos ustalarni topadi va ular sizga taklif yuboradi.') },
  { q: () => t('Takliflarni qanday solishtiraman?'), a: () => t('Har bir taklifda narx, usta reytingi, tajribasi va bajargan ishlari ko‘rinadi. Eng mos taklifni tanlab, buyurtmani tasdiqlaysiz.') },
  { q: () => t('To‘lov xavfsizmi?'), a: () => t('To‘lov platforma orqali amalga oshadi. Ish tugagach, tasdiqlaganingizdan keyin pul ustaga o‘tadi. Muammo bo‘lsa, kafolat va nizo bo‘limi orqali murojaat qilasiz.') },
  { q: () => t('Ish sifatsiz bajarilsa nima qilaman?'), a: () => t('Kafolat so‘rovi yoki nizo oching: ishni rasmlar bilan tushuntirasiz, administrator ikki tomonni ko‘rib chiqib qaror qiladi.') },
  { q: () => t('Ustani qanday baholayman?'), a: () => t('Buyurtma yakunlangach, usta uchun yulduzcha va sharh qoldirasiz. Bu keyingi mijozlarga to‘g‘ri tanlashda yordam beradi.') },
  { q: () => t('Plus obuna nima beradi?'), a: () => t('Suhbatda o‘chirilgan xabarlar va tahrir tarixini ko‘rish, so‘rovlaringizning ustalarga birinchi bo‘lib ko‘rsatilishi va Plus belgisi.') },
];

const MASTER: Qa[] = [
  { q: () => t('Usta sifatida qanday ro‘yxatdan o‘taman?'), a: () => t('Usta saytida telefon raqam bilan ro‘yxatdan o‘tasiz, kasb va xizmatlaringizni kiritasiz va tasdiqlash uchun hujjat yuborasiz. Administrator tekshirgach, profilingiz katalogda ko‘rinadi.') },
  { q: () => t('Profil reytingini qanday oshiraman?'), a: () => t('Profilni to‘liq to‘ldiring, ishlaringiz rasmlarini portfolioga qo‘shing, so‘rovlarga tez javob bering va mijozlardan sharh so‘rang.') },
  { q: () => t('Ishlarimni rasmlar bilan qanday ko‘rsataman?'), a: () => t('Portfolio bo‘limida ishdan oldin va keyingi rasmlarni yuklaysiz. Administrator tasdiqlagach, ular profilingizda ko‘rinadi.') },
  { q: () => t('Pro obuna nima beradi?'), a: () => t('Oltin Pro belgisi, katalogda yuqori o‘rin va portfolioga ikki baravar ko‘p ish qo‘shish imkoniyati.') },
  { q: () => t('Ish jadvalimni qanday boshqaraman?'), a: () => t('Jadval bo‘limida ish kunlari va soatlarini belgilaysiz. Band vaqtda yoki profilingizni pauzaga qo‘ysangiz, yangi buyurtma kelmaydi.') },
  { q: () => t('Ishlagan pulimni qanday olaman?'), a: () => t('Mijoz ishni tasdiqlagach, summa daromad bo‘limida ko‘rinadi. Tushum tarixi va to‘lovlarni o‘sha yerdan kuzatasiz.') },
];

const GENERAL: Qa[] = [
  { q: () => t('Profilim bloklansa nima qilaman?'), a: () => t('Qoidalar buzilganda profil bloklanadi. Tiklash uchun yordam xizmatiga murojaat qiling.') },
  { q: () => t('Shaxsiy ma’lumotlarim himoyalanganmi?'), a: () => t('Telefon raqamingiz katalogda ko‘rsatilmaydi. Ma’lumotlar maxfiylik siyosatiga muvofiq saqlanadi.') },
];

export const FAQ_PREVIEW: Qa[] = [CUSTOMER[0]!, CUSTOMER[2]!, CUSTOMER[3]!, MASTER[0]!];
const ALL: Qa[] = [...CUSTOMER, ...MASTER, ...GENERAL];

export function Column({ items }: { items: Qa[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="gm-faq__col">
      {items.map((item, index) => (
        <div key={index} className={cx('gm-faq__item', open === index && 'is-open')}>
          <button type="button" aria-expanded={open === index} onClick={() => setOpen(open === index ? null : index)}>
            <span className="gm-faq__q">{item.q()}</span>
            <span className="gm-faq__plus" aria-hidden="true"><Plus size={16} strokeWidth={2.6} /></span>
          </button>
          {open === index && <p>{item.a()}</p>}
        </div>
      ))}
    </div>
  );
}

export function FaqSection() {
  return (
    <section className="gm-show__block" id="savollar">
      <header className="gm-show__head gm-show__head--faq">
        <span className="gm-faq__pill">FAQ</span>
        <h2>{t('Ko‘p beriladigan savollar')}</h2>
        <p className="gm-show__lead">{t('Mijoz va ustalar uchun eng kerakli javoblar bir joyda.')}</p>
      </header>
      <div className="gm-faq gm-faq--single">
        <Column items={ALL} />
      </div>
      <SupportContacts title={t('Savolingiz qoldimi?')} />
    </section>
  );
}
