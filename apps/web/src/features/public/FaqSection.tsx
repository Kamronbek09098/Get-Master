import { useState } from 'react';
import { ChevronDown, Mail, MessageCircle, Phone } from 'lucide-react';
import { env } from '@/lib/env';
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

function Group({ title, items }: { title: string; items: Qa[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="gm-pub__faq-group">
      <h2>{title}</h2>
      {items.map((item, index) => (
        <div key={index} className={cx('gm-pub__qa', open === index && 'is-open')}>
          <button type="button" aria-expanded={open === index} onClick={() => setOpen(open === index ? null : index)}>
            <span>{item.q()}</span>
            <ChevronDown size={18} aria-hidden="true" />
          </button>
          {open === index && <p>{item.a()}</p>}
        </div>
      ))}
    </section>
  );
}

export function FaqSection() {
  const { telegram, phone, email } = env.support;
  const hasContact = !!(telegram || phone || email);
  return (
    <section className="gm-show__block" id="savollar">
      <header>
        <div>
          <h2>{t('Ko‘p beriladigan savollar')}</h2>
          <p>{t('Mijoz va ustalar uchun eng kerakli javoblar bir joyda.')}</p>
        </div>
      </header>
      <div className="gm-show__faq-groups">
        <Group title={t('Mijozlar uchun')} items={CUSTOMER} />
        <Group title={t('Ustalar uchun')} items={MASTER} />
      </div>
      <Group title={t('Umumiy')} items={GENERAL} />
      {hasContact && (
        <div className="gm-pub__contact">
          <h2>{t('Savolingiz qoldimi?')}</h2>
          <div>
            {telegram && <a href={`https://t.me/${telegram}`} target="_blank" rel="noreferrer"><MessageCircle size={18} aria-hidden="true" /> Telegram</a>}
            {phone && <a href={`tel:${phone.replace(/\s+/g, '')}`}><Phone size={18} aria-hidden="true" /> {phone}</a>}
            {email && <a href={`mailto:${email}`}><Mail size={18} aria-hidden="true" /> {email}</a>}
          </div>
        </div>
      )}
    </section>
  );
}
