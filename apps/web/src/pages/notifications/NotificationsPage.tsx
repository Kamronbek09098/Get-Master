import { NotificationList } from '@/features/notification/components/NotificationList';

export function NotificationsPage() {
  return (
    <div className="gm-notify-page">
      <div className="gm-page-header">
        <div>
          <h1>Bildirishnomalar</h1>
          <p className="gm-page-lead">Buyurtma, chat va tasdiqlash bo‘yicha yangiliklar.</p>
        </div>
      </div>
      <NotificationList />
    </div>
  );
}
