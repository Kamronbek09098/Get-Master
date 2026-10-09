import { useState } from 'react';
import type { ReactNode } from 'react';
import { Bell, Database, Plug, GitCommit, RefreshCw, Server, Tag, Timer } from 'lucide-react';
import { PageLoader } from '@/components/common/PageLoader';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/error-messages';
import { formatDateTime } from '@/lib/utils';
import { useDevOps } from '@/features/admin/hooks/useAdmin';
import { TrafficChart } from '@/features/admin/components/TrafficChart';
import type { DevOpsWindow } from '@/features/admin/types';
import './AdminDevOpsPage.css';
import { t } from '@/i18n';

const WINDOW_TABS: Array<{ value: DevOpsWindow; label: string }> = [
  { value: '1h', label: t('1 soat') },
  { value: '24h', label: t('24 soat') },
  { value: '7d', label: t('7 kun') },
];

function usageTone(percent: number): 'good' | 'warning' | 'danger' {
  if (percent >= 90) return 'danger';
  if (percent >= 70) return 'warning';
  return 'good';
}

function UsageBar({ label, percent, hint }: { label: string; percent: number; hint: string }) {
  const tone = usageTone(percent);
  return (
    <div className="gm-usage">
      <div className="gm-usage__head">
        <span>{label}</span>
        <strong>{percent}%</strong>
      </div>
      <div className="gm-usage__track">
        <span className={`gm-usage__fill gm-usage__fill--${tone}`} style={{ width: `${Math.min(100, Math.max(2, percent))}%` }} />
      </div>
      <p className="gm-card__meta">{hint}</p>
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  if (days > 0) return t('{days} kun {hours} soat', { days, hours });
  if (hours > 0) return t('{hours} soat {minutes} daq', { hours, minutes });
  return `${minutes} daq`;
}

function PingBadge({ label, ok, latencyMs }: { label: string; ok: boolean; latencyMs: number | null }) {
  const tone: BadgeTone = ok ? 'success' : 'danger';
  return (
    <div className="gm-devops-row">
      <span className="gm-devops-row__label">{label}</span>
      <Badge tone={tone}>{ok ? t('Ulangan{p}', { p: latencyMs !== null ? ` · ${latencyMs} ms` : '' }) : t('Ulanmagan')}</Badge>
    </div>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return (
    <div className="gm-devops-row">
      <span className="gm-devops-row__label">
        {icon}
        {label}
      </span>
      <strong className="gm-devops-row__value">{value}</strong>
    </div>
  );
}

export function AdminDevOpsPage() {
  const [window, setWindow] = useState<DevOpsWindow>('1h');
  const devops = useDevOps(window);
  const data = devops.data;

  return (
    <div>
      <div className="gm-page-header">
        <div>
          <h1>DevOps</h1>
          {data && <p className="gm-page-lead">{t('Tekshirildi:')}{' '}{formatDateTime(data.checkedAt)}</p>}
        </div>
        <Button variant="secondary" size="sm" loading={devops.isFetching} onClick={() => void devops.refetch()}>
          <RefreshCw size={16} />{' '}{t('Yangilash')}</Button>
      </div>

      {devops.isLoading && <PageLoader label={t('Tizim holati yuklanmoqda…')} />}
      {devops.isError && <Alert tone="danger">{getErrorMessage(devops.error)}</Alert>}

      {data && (
        <>
          {data.issues.length > 0 ? (
            <Alert tone={data.issues.some((issue) => issue.level === 'danger') ? 'danger' : 'warning'} title={t('Muammolar bor')}>
              <ul className="gm-devops-issues">
                {data.issues.map((issue) => (
                  <li key={issue.message}>{issue.message}</li>
                ))}
              </ul>
            </Alert>
          ) : (
            <Alert tone="success" title={t('Hammasi joyida')}>{t('Muammo topilmadi.')}</Alert>
          )}

          <div className="gm-devops-grid">
            <div className="gm-card">
              <UsageBar label="CPU" percent={data.system.cpuPercent} hint={t('Yuklama {join} · {cpuCount} yadro', { join: data.system.loadAvg.join(' · '), cpuCount: data.system.cpuCount })} />
            </div>
            <div className="gm-card">
              <UsageBar
                label={t('Xotira (RAM)')}
                percent={data.system.usedMemPercent}
                hint={t('{toLocaleString} MB bo‘sh / {toLocaleString2} MB', { toLocaleString: data.system.freeMemMB.toLocaleString('ru-RU'), toLocaleString2: data.system.totalMemMB.toLocaleString('ru-RU') })}
              />
            </div>
            <div className="gm-card">
              {data.system.disk ? (
                <UsageBar
                  label={t('Disk')}
                  percent={data.system.disk.usedPercent}
                  hint={t('{freeGB} GB bo‘sh / {totalGB} GB', { freeGB: data.system.disk.freeGB, totalGB: data.system.disk.totalGB })}
                />
              ) : (
                <>
                  <div className="gm-usage__head">
                    <span>{t('Disk')}</span>
                  </div>
                  <p className="gm-card__meta">{t('Disk ma’lumoti o‘qib bo‘lmadi.')}</p>
                </>
              )}
            </div>
            <div className="gm-card">
              <div className="gm-usage__head">
                <span>
                  <Timer size={14} />{' '}{t('Server ishlash vaqti')}</span>
              </div>
              <p className="gm-devops-big">{formatDuration(data.system.uptimeSeconds)}</p>
              <p className="gm-card__meta">{data.system.hostname}</p>
            </div>
          </div>

          <div className="gm-devops-cols">
            <section className="gm-detail-section">
              <h2>
                <Server size={18} />{' '}{t('Node jarayoni')}</h2>
              <div className="gm-devops-rows">
                <div className="gm-devops-row">
                  <span className="gm-devops-row__label">{t('Holat')}</span>
                  <Badge tone="success">online</Badge>
                </div>
                <InfoRow label="PID" value={data.process.pid} />
                <InfoRow label={t('Jarayon ishlash vaqti')} value={formatDuration(data.process.uptimeSeconds)} />
                <InfoRow label={t('Xotira (RSS)')} value={`${data.process.rssMB} MB`} />
                <InfoRow label={t('Heap')} value={`${data.process.heapUsedMB} / ${data.process.heapTotalMB} MB`} />
                <InfoRow label={t('CPU vaqti')} value={`${data.process.cpuUserMs} ms user · ${data.process.cpuSystemMs} ms sys`} />
              </div>
              <p className="gm-devops-note">
                <strong>{t('Nazoratchi:')}</strong>{' '}
                {{ pm2: t('PM2 boshqaradi.'), systemd: t('systemd boshqaradi.'), docker: t('Docker konteynerida ishlayapti.'), none: t('yo‘q — to‘g‘ridan-to‘g‘ri jarayon sifatida ishlaydi (PM2/systemd/Docker aniqlanmadi).') }[data.process.supervisor]}
              </p>
            </section>

            <section className="gm-detail-section">
              <h2>
                <Tag size={18} />{' '}{t('Versiya va bog‘liqliklar')}</h2>
              <div className="gm-devops-rows">
                <InfoRow icon={<GitCommit size={14} />} label={t('Commit')} value={data.version.commit ?? '—'} />
                <InfoRow label={t('Versiya')} value={`v${data.version.appVersion} · ${data.version.environment}`} />
                <InfoRow label={t('Ishga tushgan')} value={formatDateTime(data.version.startedAt)} />
                <InfoRow label="Node.js" value={data.version.nodeVersion} />
                <InfoRow label={t('Tizim')} value={data.system.platform} />
                <PingBadge label={t('Ma’lumotlar bazasi')} ok={data.dependencies.database.ok} latencyMs={data.dependencies.database.latencyMs} />
                <PingBadge label={t('Redis')} ok={data.dependencies.redis.ok} latencyMs={data.dependencies.redis.latencyMs} />
                <div className="gm-devops-row">
                  <span className="gm-devops-row__label">
                    <Bell size={14} />{' '}{t('Telegram ogohlantirish')}</span>
                  <Badge tone={data.dependencies.telegramAlerting ? 'success' : 'neutral'}>
                    {data.dependencies.telegramAlerting ? t('Sozlangan') : t('Sozlanmagan')}
                  </Badge>
                </div>
              </div>
            </section>
          </div>

          <div className="gm-devops-cols">
            <section className="gm-detail-section">
              <h2>
                <Database size={18} />{' '}{t('Zaxira nusxa')}</h2>
              <Alert tone={!data.backup.configured ? 'warning' : data.backup.stale ? 'danger' : 'success'}>{data.backup.message}</Alert>
              {data.backup.configured && (
                <div className="gm-devops-rows">
                  <InfoRow label={t('Oxirgi zaxira')} value={data.backup.lastAt ? formatDateTime(data.backup.lastAt) : '—'} />
                  <InfoRow label={t('Hajmi')} value={data.backup.sizeMB != null ? `${data.backup.sizeMB} MB` : '—'} />
                  <InfoRow label={t('Saqlangan nusxalar')} value={data.backup.count} />
                </div>
              )}
            </section>

            <section className="gm-detail-section">
              <h2>
                <Plug size={18} />{' '}{t('Tashqi xizmatlar')}</h2>
              <div className="gm-devops-rows">
                {data.providers.map((item) => (
                  <div key={item.key} className="gm-devops-prov">
                    <div className="gm-devops-row">
                      <span className="gm-devops-row__label">{item.label} · {item.provider}</span>
                      <Badge tone={item.state === 'OPEN' ? 'danger' : item.state === 'HALF_OPEN' ? 'warning' : 'success'}>
                        {item.state === 'OPEN' ? t('O‘chirilgan') : item.state === 'HALF_OPEN' ? t('Tekshirilmoqda') : t('Ishlayapti')}
                      </Badge>
                    </div>
                    <p className="gm-card__meta">
                      {t('Muvaffaqiyatli: {ok} · xato: {fail} · to‘xtatilgan: {open}', { ok: item.success, fail: item.failure, open: item.circuitOpen })}
                      {item.lastError && ` · ${t('oxirgi xato')}: ${item.lastError}`}
                    </p>
                  </div>
                ))}
                <InfoRow label={t('Server xatolari (1 soat / 24 soat)')} value={`${data.errors.lastHour} / ${data.errors.last24h}`} />
              </div>
            </section>
          </div>

          <section className="gm-detail-section">
            <div className="gm-devops-traffic-head">
              <h2>{t('API trafigi')}</h2>
              <div className="gm-tabs" role="tablist" aria-label={t('Vaqt oralig‘i')}>
                {WINDOW_TABS.map((tab) => (
                  <Button
                    key={tab.value}
                    size="sm"
                    role="tab"
                    aria-selected={window === tab.value}
                    variant={window === tab.value ? 'primary' : 'secondary'}
                    onClick={() => setWindow(tab.value)}
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>
            </div>
            <TrafficChart data={data.traffic} window={window} />
          </section>
        </>
      )}
    </div>
  );
}
