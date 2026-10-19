import { useEffect, useState } from "react";
import type { LocationRecord } from "../data/locations";
import {
  defaultNotifications,
  notificationLabels,
  type Adoption,
  type NotificationPreferences,
  type ParticipationAction,
} from "../data/participation";

const roles = ["居民", "店家", "學校", "社區團體"] as const;

// What adopting means, shown before anyone fills in a field.
export function AdoptionExplainer() {
  return (
    <dl className="adoption-explainer">
      <div>
        <dt>你會做什麼</dt>
        <dd>路過時看一眼，有問題用快捷回報，不必自己清運。</dd>
      </div>
      <div>
        <dt>你會得到什麼</dt>
        <dd>核准後可設定桶況通知，屬實首報 +2 點，公開名稱顯示在桶上。</dd>
      </div>
      <div>
        <dt>之後會怎樣</dt>
        <dd>由清潔隊審核，待審期間沒有認養權益，隨時可撤回。</dd>
      </div>
    </dl>
  );
}

// The bin is fixed by the detail page it is opened from; there is no bin picker.
export function AdoptionForm({
  location,
  loggedIn,
  onApply,
}: {
  location: LocationRecord;
  loggedIn: boolean;
  onApply: (
    action: Extract<ParticipationAction, { type: "apply" }>,
  ) => Promise<string | null>;
}) {
  const [role, setRole] = useState<Adoption["role"]>("居民");
  const [name, setName] = useState("");
  const [intro, setIntro] = useState("");
  const [preferences, setPreferences] = useState(defaultNotifications);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  if (!loggedIn)
    return (
      <div className="adoption-login">
        <AdoptionExplainer />
        <a
          className="button primary"
          href={`#login?next=${encodeURIComponent(`bin/${location.id}?adopt=1`)}`}
        >
          登入後申請
        </a>
        <p className="tiny">登入後會回到這個桶，表單已展開。</p>
      </div>
    );
  return (
    <form
      className="adoption-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (sending) return;
        setSending(true);
        const result = await onApply({
          type: "apply",
          id: crypto.randomUUID(),
          locationId: location.id,
          role,
          displayName: name,
          intro,
          preferences,
        });
        setSending(false);
        setError(result || "");
      }}
    >
      <AdoptionExplainer />
      <label>
        認養身分
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Adoption["role"])}
        >
          {roles.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <label>
        認養者公開名稱
        <input
          required
          maxLength={50}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="會公開顯示，請勿填真實姓名或電話"
        />
      </label>
      {role === "店家" && (
        <label>
          店家介紹（選填）
          <textarea
            maxLength={120}
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
          />
        </label>
      )}
      <NotificationFields value={preferences} onChange={setPreferences} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary" disabled={sending || !name.trim()}>
        送出認養申請
      </button>
      <p className="tiny">
        區清潔隊審核以「我的認養」中的展示控制模擬，不承諾3個工作天；待審尚無認養權益。
      </p>
    </form>
  );
}

export function NotificationFields({
  value,
  onChange,
  disabled = false,
}: {
  value: NotificationPreferences;
  onChange: (
    value: NotificationPreferences,
    changed: keyof NotificationPreferences,
  ) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <fieldset className="notification-fields">
      <legend>桶況通知（可全部關閉）</legend>
      {(
        Object.keys(notificationLabels) as (keyof NotificationPreferences)[]
      ).map((key) => (
        <label className="checkbox-field" key={key}>
          <input
            type="checkbox"
            disabled={disabled}
            checked={draft[key]}
            onChange={(e) => {
              const next = { ...draft, [key]: e.target.checked };
              setDraft(next);
              onChange(next, key);
            }}
          />
          {notificationLabels[key]}
        </label>
      ))}
    </fieldset>
  );
}
