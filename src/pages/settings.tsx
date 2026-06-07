import { useMemo, useState } from "react";
import {
  FormCard,
  PasswordField,
  SaveBar,
  SelectField,
  TextField,
  TextareaField,
  Toggle,
} from "../components/forms";

export const title = "Settings";
export const fullWidth = true;

/* Settings — the classic preferences surface: a left section nav, a focused
 * panel per section, and a save bar that only appears once the form is dirty.
 *
 * Dirty state is derived by comparing the working draft to the last-saved
 * snapshot, so Discard is a true revert and "Save changes" advances the
 * snapshot. Security/Billing/Team are framed as their own panels to show how
 * the same shell carries very different content. */

type Tab = "profile" | "notifications" | "security" | "billing" | "team";

type NotificationPrefs = {
  productUpdates: boolean;
  weeklyDigest: boolean;
  mentions: boolean;
  comments: boolean;
  desktopPush: boolean;
  soundAlerts: boolean;
};

type Settings = {
  fullName: string;
  email: string;
  jobTitle: string;
  timezone: string;
  bio: string;
  notifications: NotificationPrefs;
  twoFactor: boolean;
  billingEmail: string;
};

const DEFAULTS: Settings = {
  fullName: "Mark Doyle",
  email: "mark.doyle@meridian.example",
  jobTitle: "Operations Lead",
  timezone: "Europe/London",
  bio: "Runs the daily NAV sign-off and exception desk.",
  notifications: {
    productUpdates: true,
    weeklyDigest: true,
    mentions: true,
    comments: false,
    desktopPush: true,
    soundAlerts: false,
  },
  twoFactor: true,
  billingEmail: "ap@meridian.example",
};

const TABS: { id: Tab; label: string; iconPath: string }[] = [
  {
    id: "profile",
    label: "Profile",
    iconPath:
      "M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 1 1 14 0H3Z",
  },
  {
    id: "notifications",
    label: "Notifications",
    iconPath:
      "M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 0 0 0 .707-1.707L16 11.586V8a6 6 0 0 0-6-6Zm0 16a3 3 0 0 1-2.83-2h5.66A3 3 0 0 1 10 18Z",
  },
  {
    id: "security",
    label: "Security",
    iconPath:
      "M10 1 3 4v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V4l-7-3Zm0 5a2 2 0 0 1 2 2v1a2 2 0 0 1-4 0V8a2 2 0 0 1 2-2Z",
  },
  {
    id: "billing",
    label: "Billing",
    iconPath:
      "M2.5 4A1.5 1.5 0 0 0 1 5.5v1h18v-1A1.5 1.5 0 0 0 17.5 4h-15ZM19 9H1v5.5A1.5 1.5 0 0 0 2.5 16h15a1.5 1.5 0 0 0 1.5-1.5V9ZM4 13h4v1.5H4V13Z",
  },
  {
    id: "team",
    label: "Team",
    iconPath:
      "M7 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm6 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm-6 1.5c-2.8 0-5 1.6-5 3.75V16h7v-2.75c0-.9.32-1.73.86-2.4A6.6 6.6 0 0 0 7 9.5Zm6 0c-.6 0-1.17.08-1.7.22.86.78 1.4 1.83 1.4 3.03V16h5v-2.75c0-2.15-2.2-3.75-4.7-3.75Z",
  },
];

const SEATS = [
  { name: "Mark Doyle", email: "mark.doyle@meridian.example", role: "Owner", initials: "MD" },
  { name: "Priya Nair", email: "priya.nair@meridian.example", role: "Admin", initials: "PN" },
  { name: "Tom Becker", email: "tom.becker@meridian.example", role: "Member", initials: "TB" },
  { name: "Lena Ortiz", email: "lena.ortiz@meridian.example", role: "Member", initials: "LO" },
];

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const [saved, setSaved] = useState<Settings>(DEFAULTS);
  const [draft, setDraft] = useState<Settings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  );

  function patch(p: Partial<Settings>) {
    setJustSaved(false);
    setDraft((d) => ({ ...d, ...p }));
  }
  function patchNotif(p: Partial<NotificationPrefs>) {
    setJustSaved(false);
    setDraft((d) => ({ ...d, notifications: { ...d.notifications, ...p } }));
  }

  function save() {
    setSaving(true);
    setTimeout(() => {
      setSaved(draft);
      setSaving(false);
      setJustSaved(true);
    }, 500);
  }
  function discard() {
    setDraft(saved);
    setJustSaved(false);
  }

  return (
    <div className="flex h-full flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-6 py-4">
        <div className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
          Account
        </div>
        <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-neutral-900">
          Settings
        </h1>
        <p className="mt-0.5 text-xs text-neutral-500">
          Manage your profile, notifications, and workspace. Changes are staged
          until you save.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-5xl gap-8 px-6 py-6">
          {/* Section nav */}
          <nav className="sticky top-6 hidden h-fit w-48 shrink-0 flex-col gap-0.5 sm:flex">
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium transition ${
                    active
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                  }`}
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`h-4 w-4 shrink-0 ${active ? "opacity-100" : "opacity-60"}`}
                  >
                    <path fillRule="evenodd" d={t.iconPath} clipRule="evenodd" />
                  </svg>
                  {t.label}
                </button>
              );
            })}
          </nav>

          {/* Mobile tab strip */}
          <div className="min-w-0 flex-1">
            <div className="mb-4 flex gap-1 overflow-x-auto sm:hidden">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                    t.id === tab
                      ? "bg-neutral-900 text-white"
                      : "bg-white text-neutral-600 ring-1 ring-neutral-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-5">
              {tab === "profile" && (
                <ProfilePanel draft={draft} patch={patch} />
              )}
              {tab === "notifications" && (
                <NotificationsPanel draft={draft} patchNotif={patchNotif} />
              )}
              {tab === "security" && (
                <SecurityPanel
                  draft={draft}
                  patch={patch}
                  newPassword={newPassword}
                  setNewPassword={setNewPassword}
                />
              )}
              {tab === "billing" && (
                <BillingPanel draft={draft} patch={patch} />
              )}
              {tab === "team" && <TeamPanel />}
            </div>

            <SaveBar
              dirty={dirty}
              saving={saving}
              saved={justSaved}
              onSave={save}
              onReset={discard}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfilePanel({
  draft,
  patch,
}: {
  draft: Settings;
  patch: (p: Partial<Settings>) => void;
}) {
  return (
    <FormCard
      title="Profile"
      description="This information is shown to teammates across the workspace."
    >
      <div className="mb-5 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-lg font-semibold text-white">
          {initialsOf(draft.fullName) || "?"}
        </div>
        <div>
          <button
            type="button"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Change avatar
          </button>
          <p className="mt-1.5 text-[11px] text-neutral-500">JPG or PNG, up to 2MB.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Full name"
          value={draft.fullName}
          onChange={(e) => patch({ fullName: e.target.value })}
          required
        />
        <TextField
          label="Email"
          type="email"
          value={draft.email}
          onChange={(e) => patch({ email: e.target.value })}
          required
        />
        <TextField
          label="Job title"
          value={draft.jobTitle}
          onChange={(e) => patch({ jobTitle: e.target.value })}
        />
        <SelectField
          label="Timezone"
          value={draft.timezone}
          onChange={(e) => patch({ timezone: e.target.value })}
        >
          <option value="Europe/London">Europe/London (GMT+0)</option>
          <option value="Europe/Paris">Europe/Paris (GMT+1)</option>
          <option value="America/New_York">America/New York (GMT−5)</option>
          <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
        </SelectField>
        <TextareaField
          label="Bio"
          className="sm:col-span-2"
          value={draft.bio}
          hint="A short line that appears on your profile card."
          onChange={(e) => patch({ bio: e.target.value })}
          maxLength={160}
        />
      </div>
    </FormCard>
  );
}

function NotificationsPanel({
  draft,
  patchNotif,
}: {
  draft: Settings;
  patchNotif: (p: Partial<NotificationPrefs>) => void;
}) {
  const n = draft.notifications;
  return (
    <>
      <FormCard title="Email" description="Where we send activity to your inbox.">
        <div className="divide-y divide-neutral-100">
          <Toggle
            label="Product updates"
            description="New features, improvements, and the occasional changelog."
            checked={n.productUpdates}
            onChange={(v) => patchNotif({ productUpdates: v })}
          />
          <Toggle
            label="Weekly digest"
            description="A Monday summary of what changed in your queues."
            checked={n.weeklyDigest}
            onChange={(v) => patchNotif({ weeklyDigest: v })}
          />
          <Toggle
            label="Mentions"
            description="When someone @mentions you on an item."
            checked={n.mentions}
            onChange={(v) => patchNotif({ mentions: v })}
          />
          <Toggle
            label="Comment replies"
            description="Replies to threads you're part of."
            checked={n.comments}
            onChange={(v) => patchNotif({ comments: v })}
          />
        </div>
      </FormCard>
      <FormCard title="Desktop" description="Real-time alerts on this device.">
        <div className="divide-y divide-neutral-100">
          <Toggle
            label="Desktop push"
            description="Show a notification when an exception is assigned to you."
            checked={n.desktopPush}
            onChange={(v) => patchNotif({ desktopPush: v })}
          />
          <Toggle
            label="Sound alerts"
            description="Play a chime for high-severity breaks."
            checked={n.soundAlerts}
            onChange={(v) => patchNotif({ soundAlerts: v })}
            disabled={!n.desktopPush}
          />
        </div>
      </FormCard>
    </>
  );
}

function SecurityPanel({
  draft,
  patch,
  newPassword,
  setNewPassword,
}: {
  draft: Settings;
  patch: (p: Partial<Settings>) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
}) {
  return (
    <>
      <FormCard
        title="Password"
        description="Use a strong, unique password you don't reuse elsewhere."
      >
        <div className="grid max-w-md gap-4">
          <TextField
            label="Current password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
          />
          <PasswordField value={newPassword} onChange={setNewPassword} />
        </div>
      </FormCard>
      <FormCard
        title="Two-factor authentication"
        description="Add a second step at sign-in using an authenticator app."
      >
        <Toggle
          label="Authenticator app (TOTP)"
          description={
            draft.twoFactor
              ? "Enabled — codes required at every sign-in."
              : "Disabled — your account is protected by password only."
          }
          checked={draft.twoFactor}
          onChange={(v) => patch({ twoFactor: v })}
        />
      </FormCard>
      <FormCard
        title="Active sessions"
        description="Devices currently signed in to your account."
      >
        <ul className="divide-y divide-neutral-100">
          {[
            { device: "MacBook Pro · Chrome", where: "London, UK", when: "Active now", current: true },
            { device: "iPhone 15 · Safari", where: "London, UK", when: "2 hours ago", current: false },
          ].map((s) => (
            <li key={s.device} className="flex items-center justify-between py-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                  {s.device}
                  {s.current && (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      This device
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-500">
                  {s.where} · {s.when}
                </div>
              </div>
              {!s.current && (
                <button
                  type="button"
                  className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      </FormCard>
    </>
  );
}

function BillingPanel({
  draft,
  patch,
}: {
  draft: Settings;
  patch: (p: Partial<Settings>) => void;
}) {
  return (
    <>
      <FormCard
        title="Plan"
        description="You're on the Team plan, billed annually."
        action={
          <button
            type="button"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Change plan
          </button>
        }
      >
        <div className="flex items-end justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-neutral-900">Team</div>
            <div className="text-xs text-neutral-500">4 of 10 seats used</div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-semibold tabular-nums text-neutral-900">
              £240
            </span>
            <span className="text-xs text-neutral-500"> / mo</span>
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full rounded-full bg-neutral-900" style={{ width: "40%" }} />
        </div>
      </FormCard>
      <FormCard
        title="Payment method"
        action={
          <button
            type="button"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Update
          </button>
        }
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-12 items-center justify-center rounded-md bg-neutral-900 text-[10px] font-bold tracking-wide text-white">
            VISA
          </span>
          <div className="text-sm">
            <div className="font-medium text-neutral-900">•••• •••• •••• 4242</div>
            <div className="text-xs text-neutral-500">Expires 08 / 2028</div>
          </div>
        </div>
      </FormCard>
      <FormCard
        title="Billing email"
        description="Invoices and receipts are sent here."
      >
        <TextField
          label="Billing email"
          type="email"
          className="max-w-md"
          value={draft.billingEmail}
          onChange={(e) => patch({ billingEmail: e.target.value })}
        />
      </FormCard>
    </>
  );
}

function TeamPanel() {
  return (
    <FormCard
      title="Members"
      description="People with access to this workspace."
      action={
        <button
          type="button"
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
        >
          + Invite
        </button>
      }
    >
      <ul className="divide-y divide-neutral-100">
        {SEATS.map((m) => (
          <li key={m.email} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">
                {m.initials}
              </span>
              <div>
                <div className="text-sm font-medium text-neutral-900">{m.name}</div>
                <div className="text-xs text-neutral-500">{m.email}</div>
              </div>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                m.role === "Owner"
                  ? "bg-neutral-900 text-white"
                  : m.role === "Admin"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-neutral-100 text-neutral-600"
              }`}
            >
              {m.role}
            </span>
          </li>
        ))}
      </ul>
    </FormCard>
  );
}
