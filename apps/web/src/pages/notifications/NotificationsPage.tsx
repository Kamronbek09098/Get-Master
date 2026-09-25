import { NotificationList } from '@/features/notification/components/NotificationList';

export function NotificationsPage() {
  return (
    <div className="gm-notify-page">
      <div className="gm-page-header">
        <div>
          <h1>Bildirishnomalar</h1>
          <p style={{ margin: 0, color: 'var(--gm-color-text-muted)' }}>Buyurtma, chat va tasdiqlash bo‘yicha yangiliklar.</p>
        </div>
      </div>
      <NotificationList />
    </div>
  );
}
