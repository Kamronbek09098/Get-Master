import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Star, Users } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/common/PageLoader';
import { accountName } from '@/lib/account-name';
import { getErrorMessage } from '@/lib/error-messages';
import { ChatAvatar } from '@/features/communication/components/ChatAvatar';
import { CoverageMap } from '@/features/geo/components/CoverageMap';
import type { CoverageZone } from '@/features/geo/components/CoverageMap';
import { useCoveringMasters } from '../hooks/useMaster';
import './AddressMastersDialog.css';

/** Inline qisqa xulosa: «Bu manzilga N ta usta kela oladi» + ko‘rish tugmasi. */
export function CoverageSummary({ lat, lon, onOpen }: { lat: number | null; lon: number | null; onOpen: () => void }) {
  const covering = useCoveringMasters(lat, lon);
  if (lat == null || lon == null) return null;
  if (covering.isLoading) return <p className="gm-covsum gm-covsum--muted">Manzilga kela oladigan ustalar tekshirilmoqda…</p>;
  if (covering.isError || !covering.data) return null;
  const total = covering.data.total;
  return (
    <button type="button" className={total > 0 ? 'gm-covsum' : 'gm-covsum gm-covsum--none'} onClick={onOpen}>
      <span className="gm-covsum__icon" aria-hidden="true">
        <Users size={18} />
      </span>
      <span className="gm-covsum__text">
        {total > 0 ? (
          <>
            Bu manzilga <strong>{total} ta usta</strong> kela oladi
          </>
        ) : (
          'Hozircha bu manzilga kela oladigan usta topilmadi'
        )}
      </span>
      <span className="gm-covsum__cta">
        Xaritada ko‘rish <ChevronRight size={16} aria-hidden="true" />
      </span>
    </button>
  );
}

/** Manzil kartasidagi tugma: nomi, kela oladigan ustalar soni va strelka. */
export function CoverageButton({ lat, lon, onOpen }: { lat: number; lon: number; onOpen: () => void }) {
  const covering = useCoveringMasters(lat, lon);
  const total = covering.data?.total;
  return (
    <button type="button" className="gm-covbtn" onClick={onOpen}>
      <span className="gm-covbtn__icon" aria-hidden="true">
        <Users size={17} />
      </span>
      <span className="gm-covbtn__label">Qaysi ustalar yetib keladi</span>
      <span className="gm-covbtn__end">
        {covering.isLoading ? (
          <span className="gm-covbtn__count gm-covbtn__count--wait" aria-label="Tekshirilmoqda">…</span>
        ) : total !== undefined ? (
          <span className={total > 0 ? 'gm-covbtn__count' : 'gm-covbtn__count gm-covbtn__count--zero'}>{total}</span>
        ) : null}
        <ChevronRight size={18} className="gm-covbtn__arrow" aria-hidden="true" />
      </span>
    </button>
  );
}

/** Manzilga kela oladigan ustalar: xaritada ularning ish hududlari va ro‘yxat. */
export function AddressMastersDialog({
  open,
  onClose,
  lat,
  lon,
  addressLine,
}: {
  open: boolean;
  onClose: () => void;
  lat: number | null;
  lon: number | null;
  addressLine?: string;
}) {
  const covering = useCoveringMasters(open ? lat : null, open ? lon : null);
  const items = useMemo(() => covering.data?.items ?? [], [covering.data]);

  const zones = useMemo<CoverageZone[]>(
    () =>
      items.flatMap((master) =>
        master.coverage ? [{ id: master.id, lat: master.coverage.lat, lon: master.coverage.lon, radiusKm: master.coverage.radiusKm, label: accountName(master.user) }] : [],
      ),
    [items],
  );
  const point = useMemo(() => (lat != null && lon != null ? { lat, lon } : null), [lat, lon]);

  return (
    <Modal open={open} onClose={onClose} title="Manzilga kela oladigan ustalar" wide footer={<Button onClick={onClose}>Yopish</Button>}>
      <div className="gm-addrm">
        {addressLine && <p className="gm-addrm__addr">{addressLine}</p>}
        {covering.isLoading && <PageLoader label="Ustalar qidirilmoqda…" />}
        {covering.isError && <Alert tone="danger">{getErrorMessage(covering.error)}</Alert>}
        {covering.data && (
          <>
            <CoverageMap latitude={null} longitude={null} point={point} zones={zones} height="min(46dvh, 380px)" wheelZoom />
            <p className="gm-addrm__legend">
              <span className="gm-addrm__dot gm-addrm__dot--home" /> Sizning manzilingiz <span className="gm-addrm__dot" /> Usta ish hududi (doira)
            </p>
            {items.length === 0 ? (
              <p className="gm-pempty">Bu manzil hozircha birorta faol ustaning ish hududiga kirmaydi.</p>
            ) : (
              <ul className="gm-addrm__list">
                {items.map((master) => {
                  const name = accountName(master.user);
                  return (
                    <li key={master.id}>
                      <Link to={`/ustalar-katalogi/${master.user.accountNumber ?? master.id}`} className="gm-addrm__item" onClick={onClose}>
                        <ChatAvatar name={name} seed={master.id} size="md" />
                        <span className="gm-addrm__info">
                          <strong>{name}</strong>
                          <span>{master.profession ?? 'Kasb ko‘rsatilmagan'}</span>
                        </span>
                        <span className="gm-addrm__meta">
                          <span className="gm-addrm__rating">
                            <Star size={13} fill="currentColor" aria-hidden="true" /> {master.ratingCount > 0 ? Number(master.ratingAvg).toFixed(1) : 'Yangi'}
                          </span>
                          <span className="gm-addrm__dist">{master.distanceKm} km</span>
                        </span>
                        <ChevronRight size={18} className="gm-addrm__arrow" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
