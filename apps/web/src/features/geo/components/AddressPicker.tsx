import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, LocateFixed, Map as MapIcon, MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useDebounce } from '@/hooks/useDebounce';
import { geoService } from '../geo.service';
import type { GeoPlace } from '../geo.service';
import { MapPicker } from './MapPicker';
import './geo.css';

export interface PickedAddress {
  addressLine: string;
  city: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
}

export interface AddressPickerProps {
  value: PickedAddress;
  onChange: (next: PickedAddress) => void;
  label?: string;
}

const toPicked = (place: GeoPlace, fallbackLine = ''): PickedAddress => ({
  addressLine: place.addressLine || fallbackLine,
  city: place.city ?? '',
  district: place.district ?? '',
  latitude: place.latitude,
  longitude: place.longitude,
});

/** Manzil kiritish: yozib qidirish (takliflar bilan), xaritadan tanlash va joriy joylashuv. */
export function AddressPicker({ value, onChange, label = 'Manzil' }: AddressPickerProps) {
  const [text, setText] = useState(value.addressLine);
  const [items, setItems] = useState<GeoPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const skipNext = useRef(false);
  const debounced = useDebounce(text.trim(), 320);

  // Tashqaridan qiymat o‘zgarsa (masalan, forma tozalansa) matnni yangilaymiz.
  useEffect(() => {
    if (value.addressLine !== text) {
      skipNext.current = true;
      setText(value.addressLine);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.addressLine]);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    if (debounced.length < 3) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setBusy(true);
    geoService
      .suggest(debounced, value.latitude != null && value.longitude != null ? { lat: value.latitude, lon: value.longitude } : undefined)
      .then((result) => {
        if (!cancelled) {
          setItems(result.items);
          setOpen(true);
        }
      })
      .catch(() => !cancelled && setItems([]))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  async function choose(item: GeoPlace) {
    setOpen(false);
    setNote(null);
    let place = item;
    if (item.latitude == null || item.longitude == null) {
      setBusy(true);
      try {
        const result = await geoService.geocode(item.uri ? { uri: item.uri } : { q: item.addressLine });
        if (result.place) place = { ...item, ...result.place, addressLine: item.addressLine || result.place.addressLine };
      } catch {
        setNote('Koordinatani aniqlab bo‘lmadi, manzil matn ko‘rinishida saqlanadi.');
      } finally {
        setBusy(false);
      }
    }
    const next = toPicked(place, item.addressLine);
    skipNext.current = true;
    setText(next.addressLine);
    onChange(next);
  }

  function locateMe() {
    setNote(null);
    if (!navigator.geolocation) {
      setNote('Bu qurilmada joylashuvni aniqlab bo‘lmaydi.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        geoService
          .reverse(latitude, longitude)
          .then(({ place }) => {
            const next: PickedAddress = place
              ? { ...toPicked(place), latitude, longitude }
              : { addressLine: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, city: '', district: '', latitude, longitude };
            skipNext.current = true;
            setText(next.addressLine);
            onChange(next);
          })
          .catch(() => setNote('Manzilni aniqlab bo‘lmadi.'))
          .finally(() => setBusy(false));
      },
      () => {
        setBusy(false);
        setNote('Joylashuvga ruxsat berilmadi.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const located = value.latitude != null && value.longitude != null;

  return (
    <div className="gm-addrpick" ref={wrap}>
      <div className="gm-field">
        <label htmlFor="gm-addr-input" className="gm-field__label">
          {label} <span aria-hidden="true">*</span>
        </label>
        <div className="gm-field__wrap gm-field__wrap--icon">
          <input
            id="gm-addr-input"
            className="gm-field__control"
            value={text}
            autoComplete="off"
            required
            placeholder="Ko‘cha, uy raqami yoki mo‘ljal…"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            onFocus={() => items.length > 0 && setOpen(true)}
            onChange={(event) => {
              const next = event.target.value;
              setText(next);
              // Qo‘lda o‘zgartirilsa, avvalgi koordinata eskirgan hisoblanadi.
              onChange({ ...value, addressLine: next, latitude: null, longitude: null });
            }}
          />
          <span className="gm-field__reveal gm-addrpick__status" aria-hidden="true" style={{ pointerEvents: 'none' }}>
            {busy ? <Loader2 size={18} className="gm-spin" /> : <Search size={18} />}
          </span>
        </div>
        {open && items.length > 0 && (
          <ul className="gm-addrpick__list" role="listbox">
            {items.map((item, index) => (
              <li key={`${item.uri ?? item.addressLine}-${index}`}>
                <button type="button" className="gm-addrpick__item" role="option" aria-selected={false} onClick={() => void choose(item)}>
                  <MapPin size={16} aria-hidden="true" />
                  <span>
                    <strong>{item.title || item.addressLine}</strong>
                    {item.subtitle && <small>{item.subtitle}</small>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="gm-addrpick__actions">
        <Button type="button" size="sm" variant="secondary" onClick={() => setMapOpen(true)}>
          <MapIcon size={16} /> Xaritadan tanlash
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => locateMe()}>
          <LocateFixed size={16} /> Joriy joylashuvim
        </Button>
      </div>

      {located ? (
        <span className="gm-addrpick__coords">
          <CheckCircle2 size={14} aria-hidden="true" /> Xaritada aniqlangan ({value.latitude?.toFixed(4)}, {value.longitude?.toFixed(4)})
        </span>
      ) : (
        <p className="gm-addrpick__hint">{note ?? 'Manzilni yozing va ro‘yxatdan tanlang yoki xaritadan belgilang — usta aniq joyni ko‘radi.'}</p>
      )}

      {mapOpen && (
        <MapPicker
          open
          initial={value}
          onClose={() => setMapOpen(false)}
          onPick={(place) => {
            const next = toPicked(place);
            skipNext.current = true;
            setText(next.addressLine);
            onChange(next);
            setMapOpen(false);
          }}
        />
      )}
    </div>
  );
}
