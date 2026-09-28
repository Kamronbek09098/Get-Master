import { useState } from 'react';
import { Bell, Database, GitCommit, RefreshCw, Server, Tag, Timer } from 'lucide-react';
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

const WINDOW_TABS: Array<{ value: DevOpsWindow; label: string }> = [
  { value: '1h', label: '1 soat' },
  { value: '24h', label: '24 soat' },
  { value: '7d', label: '7 kun' },
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
  if (days > 0) return `${days} kun ${hours} soat`;
  if (hours > 0) return `${hours} soat ${minutes} daq`;
  return `${minutes} daq`;
}

function PingBadge({ label, ok, latencyMs }: { label: string; ok: boolean; latencyMs: number | null }) {
  const tone: BadgeTone = ok ? 'success' : 'danger';
  return (
    <div className="gm-key-value__row">
      <span>{label}</span>
      <Badge tone={tone}>{ok ? `Ulangan${latencyMs !== null ? ` · ${latencyMs} ms` : ''}` : 'Ulanmagan'}</Badge>
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
          {data && <p className="gm-page-lead">Tekshirildi: {formatDateTime(data.checkedAt)}</p>}
        </div>
        <Button variant="secondary" size="sm" loading={devops.isFetching} onClick={() => void devops.refetch()}>
          <RefreshCw size={16} /> Yangilash
        </Button>
      </div>

      {devops.isLoading && <PageLoader label="Tizim holati yuklanmoqda…" />}
      {devops.isError && <Alert tone="danger">{getErrorMessage(devops.error)}</Alert>}

      {data && (
        <>
          {data.issues.length > 0 ? (
            <Alert tone={data.issues.some((issue) => issue.level === 'danger') ? 'danger' : 'warning'} title="Muammolar bor">
              <ul className="gm-devops-issues">
                {data.issues.map((issue) => (
                  <li key={issue.message}>{issue.message}</li>
                ))}
              </ul>
            </Alert>
          ) : (
            <Alert tone="success" title="Hammasi joyida">
              Muammo topilmadi.
            </Alert>
          )}

          <div className="gm-devops-grid">
            <div className="gm-card">
              <UsageBar label="CPU" percent={data.system.cpuPercent} hint={`Yuklama ${data.system.loadAvg.join(' · ')} · ${data.system.cpuCount} yadro`} />
            </div>
            <div className="gm-card">
              <UsageBar
                label="Xotira (RAM)"
                percent={data.system.usedMemPercent}
                hint={`${data.system.freeMemMB.toLocaleString('ru-RU')} MB bo‘sh / ${data.system.totalMemMB.toLocaleString('ru-RU')} MB`}
              />
            </div>
            <div className="gm-card">
              {data.system.disk ? (
                <UsageBar
                  label="Disk"
                  percent={data.system.disk.usedPercent}
                  hint={`${data.system.disk.freeGB} GB bo‘sh / ${data.system.disk.totalGB} GB`}
                />
              ) : (
                <>
                  <div className="gm-usage__head">
                    <span>Disk</span>
                  </div>
                  <p className="gm-card__meta">Disk ma’lumoti o‘qib bo‘lmadi.</p>
                </>
              )}
            </div>
            <div className="gm-card">
              <div className="gm-usage__head">
                <span>
                  <Timer size={14} /> Server ishlash vaqti
                </span>
              </div>
              <p className="gm-devops-big">{formatDuration(data.system.uptimeSeconds)}</p>
              <p className="gm-card__meta">{data.system.hostname}</p>
            </div>
          </div>

          <div className="gm-devops-cols">
            <section className="gm-detail-section">
              <h2>
                <Server size={18} /> Node jarayoni
              </h2>
              <div className="gm-key-value gm-key-value--rows">
                <div className="gm-key-value__row">
                  <span>Holat</span>
                  <Badge tone="success">online</Badge>
                </div>
                <div className="gm-key-value__row">
                  <span>PID</span>
                  <strong>{data.process.pid}</strong>
                </div>
                <div className="gm-key-value__row">
                  <span>Jarayon ishlash vaqti</span>
                  <strong>{formatDuration(data.process.uptimeSeconds)}</strong>
                </div>
                <div className="gm-key-value__row">
                  <span>Xotira (RSS)</span>
                  <strong>{data.process.rssMB} MB</strong>
                </div>
                <div className="gm-key-value__row">
                  <span>Heap</span>
                  <strong>
                    {data.process.heapUsedMB} / {data.process.heapTotalMB} MB
                  </strong>
                </div>
                <div className="gm-key-value__row">
                  <span>CPU vaqti</span>
                  <strong>
                    {data.process.cpuUserMs} ms user · {data.process.cpuSystemMs} ms sys
                  </strong>
                </div>
                <div className="gm-key-value__row">
                  <span>Nazoratchi</span>
                  <span className="gm-card__meta">Yo‘q — Docker konteynerida to‘g‘ridan-to‘g‘ri jarayon (PM2/systemd ishlatilmaydi)</span>
                </div>
              </div>
            </section>

            <section className="gm-detail-section">
              <h2>
                <Tag size={18} /> Versiya va bog‘liqliklar
              </h2>
              <div className="gm-key-value gm-key-value--rows">
                <div className="gm-key-value__row">
                  <span>
                    <GitCommit size={14} /> Commit
                  </span>
                  <strong>{data.version.commit ?? '—'}</strong>
                </div>
                <div className="gm-key-value__row">
                  <span>Versiya</span>
                  <strong>
                    v{data.version.appVersion} · {data.version.environment}
                  </strong>
                </div>
                <div className="gm-key-value__row">
                  <span>Ishga tushgan</span>
                  <strong>{formatDateTime(data.version.startedAt)}</strong>
                </div>
                <div className="gm-key-value__row">
                  <span>Node.js</span>
                  <strong>{data.version.nodeVersion}</strong>
                </div>
                <div className="gm-key-value__row">
                  <span>Tizim</span>
                  <strong>{data.system.platform}</strong>
                </div>
                <PingBadge label="Ma’lumotlar bazasi" ok={data.dependencies.database.ok} latencyMs={data.dependencies.database.latencyMs} />
                <PingBadge label="Redis" ok={data.dependencies.redis.ok} latencyMs={data.dependencies.redis.latencyMs} />
                <div className="gm-key-value__row">
                  <span>
                    <Bell size={14} /> Telegram ogohlantirish
                  </span>
                  <Badge tone={data.dependencies.telegramAlerting ? 'success' : 'neutral'}>
                    {data.dependencies.telegramAlerting ? 'Sozlangan' : 'Sozlanmagan'}
                  </Badge>
                </div>
              </div>
            </section>
          </div>

          <section className="gm-detail-section">
            <h2>
              <Database size={18} /> Zaxira nusxa
            </h2>
            <Alert tone={data.backup.configured ? 'success' : 'warning'}>{data.backup.message}</Alert>
          </section>

          <section className="gm-detail-section">
            <div className="gm-devops-traffic-head">
              <h2>API trafigi</h2>
              <div className="gm-tabs" role="tablist" aria-label="Vaqt oralig‘i">
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
