import { Bookmark, Compass, Film, Search, UserPlus, WifiOff, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { t } from '@/i18n';
import type { FeedTab } from '../types';

function Empty({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="gf-empty" role="status">
      <span className="gf-empty__ico" aria-hidden="true">{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
      {children && <div className="gf-empty__actions">{children}</div>}
    </div>
  );
}

export function FeedSkeleton() {
  return (
    <div className="gf-item gf-item--skeleton" role="status" aria-label={t('Lenta yuklanmoqda')}>
      <div className="gf-stage">
        <div className="gf-skel gf-skel--stage" />
        <div className="gf-info" aria-hidden="true">
          <div className="gf-creator">
            <span className="gf-skel gf-skel--avatar" />
            <span className="gf-skel gf-skel--line" style={{ width: 160 }} />
          </div>
          <span className="gf-skel gf-skel--line" style={{ width: '80%' }} />
          <span className="gf-skel gf-skel--line" style={{ width: '55%' }} />
          <span className="gf-skel gf-skel--btn" />
        </div>
      </div>
    </div>
  );
}

export function FeedError({ onRetry }: { onRetry: () => void }) {
  return (
    <Empty icon={<WifiOff size={30} />} title={t('Lentani yuklab bo‘lmadi')} text={t('Internet aloqasini tekshiring va qayta urinib ko‘ring.')}>
      <button type="button" className="gf-btn gf-btn--lg" onClick={onRetry}>{t('Qayta urinish')}</button>
    </Empty>
  );
}

export function FeedEmpty({ tab, hasFilter, hasQuery, onReset, canUpload, base }: { tab: FeedTab; hasFilter: boolean; hasQuery: boolean; onReset: () => void; canUpload: boolean; base: string }) {
  if (hasQuery) {
    return (
      <Empty icon={<Search size={30} />} title={t('Hech narsa topilmadi')} text={t('Boshqa so‘z yoki kategoriya bilan urinib ko‘ring.')}>
        <button type="button" className="gf-btn gf-btn--lg" onClick={onReset}>{t('Qidiruvni tozalash')}</button>
      </Empty>
    );
  }
  if (hasFilter) {
    return (
      <Empty icon={<Compass size={30} />} title={t('Bu yo‘nalishda ish yo‘q')} text={t('Hozircha bu kasb bo‘yicha ish joylanmagan. Boshqa yo‘nalishni tanlang.')}>
        <button type="button" className="gf-btn gf-btn--lg" onClick={onReset}>{t('Barcha ishlar')}</button>
      </Empty>
    );
  }
  if (tab === 'following') {
    return (
      <Empty icon={<UserPlus size={30} />} title={t('Hali hech kimni kuzatmayapsiz')} text={t('Yoqqan ustalaringizni kuzating, ularning yangi ishlari shu yerda chiqadi.')}>
        <button type="button" className="gf-btn gf-btn--lg" onClick={onReset}>{t('Barcha ishlarni ko‘rish')}</button>
      </Empty>
    );
  }
  if (tab === 'saved') {
    return (
      <Empty icon={<Bookmark size={30} />} title={t('Saqlangan ishlar yo‘q')} text={t('Yoqqan ishni belgi tugmasi bilan saqlab qo‘ying, keyin shu yerdan topasiz.')}>
        <button type="button" className="gf-btn gf-btn--lg" onClick={onReset}>{t('Lentaga qaytish')}</button>
      </Empty>
    );
  }
  return (
    <Empty icon={<Film size={30} />} title={t('Hozircha ishlar yo‘q')} text={canUpload ? t('Birinchi bo‘lib o‘z ishingizni joylang: mijozlar sizni shu yerda topadi.') : t('Ustalar tez orada o‘z ishlarini shu yerda ko‘rsatadi.')}>
      {canUpload && <Link to={`${base}/lenta/yangi`} className="gf-btn gf-btn--lg">{t('Ish joylash')}</Link>}
    </Empty>
  );
}

export function PostGone({ onBack }: { onBack: () => void }) {
  return (
    <Empty icon={<Trash2 size={30} />} title={t('Bu ish topilmadi')} text={t('Usta uni o‘chirgan yoki u endi ochiq emas.')}>
      <button type="button" className="gf-btn gf-btn--lg" onClick={onBack}>{t('Lentaga qaytish')}</button>
    </Empty>
  );
}
