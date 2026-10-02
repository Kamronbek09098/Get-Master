import { ADMIN_PERMISSION_OPTIONS } from "../permissions";

const GROUPS = ["Boshqaruv", "Kontent", "Tizim"] as const;

/** Oddiy admin uchun ruxsat beriladigan bo‘limlarni tanlash (guruhlangan belgilash qutilari). */
export function PermissionPicker({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const total = ADMIN_PERMISSION_OPTIONS.length;
  const all = value.length === total;
  const toggle = (key: string) =>
    onChange(
      value.includes(key)
        ? value.filter((item) => item !== key)
        : [...value, key],
    );

  return (
    <fieldset className="gm-perm" disabled={disabled}>
      <legend className="gm-perm__legend">
        <span>
          Ruxsat beriladigan bo‘limlar{" "}
          <small
            className={
              value.length === 0
                ? "gm-perm__count gm-perm__count--empty"
                : "gm-perm__count"
            }
          >
            {value.length} / {total} tanlandi
          </small>
        </span>
        <button
          type="button"
          className="gm-perm__all"
          onClick={() =>
            onChange(
              all ? [] : ADMIN_PERMISSION_OPTIONS.map((option) => option.value),
            )
          }
        >
          {all ? "Hammasini olib tashlash" : "Hammasini tanlash"}
        </button>
      </legend>
      <div className="gm-perm__groups">
        {GROUPS.map((group) => (
          <div key={group} className="gm-perm__group">
            <p className="gm-perm__group-title">{group}</p>
            <div className="gm-perm__grid">
              {ADMIN_PERMISSION_OPTIONS.filter(
                (option) => option.group === group,
              ).map((option) => (
                <label key={option.value} className="gm-perm__item">
                  <input
                    type="checkbox"
                    checked={value.includes(option.value)}
                    onChange={() => toggle(option.value)}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.hint}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
