import { NotificationList } from '@/features/notification/components/NotificationList';
import { t } from '@/i18n';

export function NotificationsPage() {
  return (
    <div className="gm-notify-page">
      <div className="gm-page-header">
        <div>
          <h1>{t('Bildirishnomalar')}</h1>
          <p className="gm-page-lead">{t('Buyurtma, chat va tasdiqlash bo‘yicha yangiliklar.')}</p>
        </div>
      </div>
      <NotificationList />
    </div>
  );
}
