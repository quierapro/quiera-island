import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, Reorder } from "motion/react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openLink } from "../ipc/notifications";
import { checkForUpdates, getUpdateStatus, installUpdate, onUpdateStatus, type UpdateStatus } from "../ipc/updates";
import { checkCalendarLink } from "../ipc/calendar";
import { connectAgent, getAgentsStatus, startAgentsPhone, stopAgentsPhone, type AgentsStatus, type HookStatus } from "../ipc/agents";
import type { PhoneLink } from "../ipc/shelf";
import { islandShortcutHeld, setShortcutRecording } from "../ipc/island";
import { better, hotkeyLabel, isSingleKey, pressed } from "./hotkey";
import { getHeldShortcut, getMonitors, SHORTCUTS, type Hotkey, type Monitor, type Settings, type Shortcut } from "../ipc/settings";
import { updateSettings, useSettings } from "./store";
import { localeOf, useLang, useT } from "../i18n";
import type { Tab } from "../machine/island-machine";
import { orderTabs, TABS } from "../island/tabs";
import { tabFace } from "../island/TabBar";

const ignore = () => {};
const REPO = "https://github.com/quierapro/quiera-island";

type Section = "general" | "tabs" | "calendar" | "agents" | "launcher" | "media" | "notifications" | "clipboard" | "peeks" | "about";

const SECTIONS: { id: Section; icon: ReactNode }[] = [
  { id: "general", icon: <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 12h2m12 0h2M12 4v2m0 12v2M6.3 6.3l1.4 1.4m8.6 8.6 1.4 1.4m0-11.4-1.4 1.4m-8.6 8.6-1.4 1.4" /> },
  { id: "tabs", icon: <Icon d="M3 9.5h18M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm2.5 2.2h3m2 0h3" /> },
  { id: "calendar", icon: <Icon d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5Zm-1.5 5h17M8 3.5v4m8-4v4" /> },
  { id: "agents", icon: <Icon d="M12 3c.6 4.6 3.4 7.4 8 8-4.6.6-7.4 3.4-8 8-.6-4.6-3.4-7.4-8-8 4.6-.6 7.4-3.4 8-8Z" /> },
  { id: "launcher", icon: <Icon d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4.5 4.5" /> },
  { id: "media", icon: <Icon d="M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /> },
  { id: "notifications", icon: <Icon d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2ZM10 20.5a2.2 2.2 0 0 0 4 0" /> },
  { id: "clipboard", icon: <Icon d="M8.5 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1.5M9 4h6v3H9V4Z" /> },
  { id: "peeks", icon: <Icon d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Zm9 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /> },
  { id: "about", icon: <Icon d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5v-5m0-3h.01" /> },
];

function Icon({ d }: { d: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** One setting: its name, what it does, and its control. */
function Row({
  title,
  description,
  children,
  disabled = false,
  stacked = false,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  /** The control goes under the text (wide controls). */
  stacked?: boolean;
}) {
  return (
    <div className={`row ${disabled ? "row--off" : ""} ${stacked ? "row--stacked" : ""}`}>
      <div className="row-text">
        <div className="row-title">{title}</div>
        {description && <div className="row-desc">{description}</div>}
      </div>
      <div className="row-control">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, label, disabled = false }: { on: boolean; onChange(on: boolean): void; label: string; disabled?: boolean }) {
  return (
    <button className={`toggle ${on ? "toggle--on" : ""}`} role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}>
      <motion.span className="toggle-knob" layout transition={{ type: "spring", stiffness: 700, damping: 40 }} />
    </button>
  );
}

function Choice<T extends string>({ value, options, onChange, disabled = false }: { value: T; options: { value: T; label: string }[]; onChange(value: T): void; disabled?: boolean }) {
  return (
    <div className="choice" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} className={`choice-item ${value === o.value ? "choice-item--on" : ""}`} disabled={disabled} onClick={() => onChange(o.value)}>
          {value === o.value && <motion.span layoutId={`choice-${options.map((x) => x.value).join()}`} className="choice-pill" transition={{ type: "spring", stiffness: 600, damping: 42 }} />}
          <span className="choice-label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="group">
      {title && <h2 className="group-title">{title}</h2>}
      <div className="group-body">{children}</div>
    </section>
  );
}

/** Applies one change to the settings; a save that fails shows a message. */
function useSave() {
  const [error, setError] = useState<string | null>(null);
  const save = (change: (s: Settings) => Settings) => {
    setError(null);
    updateSettings(change).catch((e) => setError(String(e)));
  };
  return { save, error };
}

const NO_HOTKEY: Hotkey = { ctrl: false, alt: false, shift: false, win: false, key: 0, label: "", double: false };

/**
 * A shortcut recorded from the keyboard: click, press the keys, release
 * them: what was held is the shortcut (a modifier alone too). Escape
 * cancels; the × takes it away. A key alone can be asked twice. Says when
 * another app already holds it.
 */
function ShortcutRecorder({ value, onChange }: { value: Hotkey; onChange(hotkey: Hotkey): void }) {
  const messages = useT();
  const t = messages.settings.general;
  const names = { shift: messages.shortcut("Maj"), space: messages.shortcut("Espace"), none: t.noShortcut, twice: t.twice };
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    if (!recording) return;
    // The current shortcut lets its keys through meanwhile.
    setShortcutRecording(true);
    let best: Hotkey | null = null;
    let alone = false;
    const down = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape" && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        setRecording(false);
        return;
      }
      if (e.repeat) return;
      const recorded = pressed(e, names);
      if (recorded.kind === "candidate") {
        best = better(best, recorded.hotkey);
        setPending(hotkeyLabel({ ...best, double: false }, names));
        setWarning(null);
      } else if (recorded.kind === "pending") {
        setPending(recorded.label);
      } else {
        alone = true;
      }
    };
    // Released: what was held is the shortcut.
    const up = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;
      if (best) {
        change.current(best);
        setRecording(false);
      } else {
        setWarning(alone ? t.shortcutAlone : t.shortcutModifiers);
        setPending("");
      }
      best = null;
      alone = false;
    };
    const leave = () => setRecording(false);
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", leave);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", leave);
      setShortcutRecording(false);
      setPending("");
    };
  }, [recording]);

  // Once set: does Windows give it?
  const key = `${value.ctrl}${value.alt}${value.shift}${value.win}${value.key}${value.double}`;
  useEffect(() => {
    if (!value.key) return;
    const timer = setTimeout(() => {
      islandShortcutHeld()
        .then((held) => setWarning(held ? null : t.shortcutTaken))
        .catch(ignore);
    }, 400);
    return () => clearTimeout(timer);
  }, [key]);

  return (
    <div className="hotkey-field">
      <div className="hotkey-row">
        <button
          className={`hotkey ${recording ? "hotkey--recording" : ""} ${value.key ? "" : "hotkey--none"}`}
          onClick={() => {
            setWarning(null);
            setRecording((r) => !r);
          }}
        >
          {recording ? pending || t.pressKeys : hotkeyLabel(value, names)}
        </button>
        {value.key !== 0 && !recording && (
          <button className="hotkey-clear" aria-label={t.clearShortcut} title={t.clearShortcut} onClick={() => onChange(NO_HOTKEY)}>
            ×
          </button>
        )}
      </div>
      {isSingleKey(value) && !recording && (
        <div className="hotkey-double">
          <span>{t.pressTwice}</span>
          <Toggle label={t.pressTwice} on={value.double} onChange={(double) => onChange({ ...value, double })} />
        </div>
      )}
      {warning && <div className="hotkey-warning">{warning}</div>}
    </div>
  );
}

function General({ settings, save }: { settings: Settings; save: ReturnType<typeof useSave>["save"] }) {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  useEffect(() => {
    getMonitors().then(setMonitors).catch(ignore);
  }, []);
  const t = useT().settings.general;
  const g = settings.general;
  const set = (patch: Partial<Settings["general"]>) => save((s) => ({ ...s, general: { ...s.general, ...patch } }));
  return (
    <>
      <Group>
        <Row title={t.startup} description={t.startupHint}>
          <Toggle label={t.startupLabel} on={g.startWithWindows} onChange={(on) => set({ startWithWindows: on })} />
        </Row>
        <Row title={t.language} description={t.languageHint}>
          <Choice
            value={g.language}
            onChange={(language) => set({ language })}
            options={[
              { value: "system", label: t.languages.system },
              { value: "fr", label: t.languages.fr },
              { value: "en", label: t.languages.en },
            ]}
          />
        </Row>
        <Row title={t.screen} description={t.screenHint}>
          <select className="select" value={g.screen ?? ""} onChange={(e) => set({ screen: e.target.value || null })}>
            <option value="">{t.primaryScreen}</option>
            {monitors.map((m) => (
              <option key={m.name} value={m.name}>
                {m.primary ? t.primary : ""}
                {m.width} × {m.height} ({m.name.replace(/^\\\\\.\\/, "")})
              </option>
            ))}
          </select>
        </Row>
      </Group>
      <Group title={t.behaviour}>
        <Row title={t.hover} description={t.hoverHint}>
          <Toggle label={t.hover} on={g.openOnHover} onChange={(on) => set({ openOnHover: on })} />
        </Row>
        <Row title={t.passThrough} description={t.passThroughHint}>
          <Toggle label={t.passThrough} on={g.passThrough} onChange={(on) => set({ passThrough: on })} />
        </Row>
        <Row title={t.islandShortcut} description={t.islandShortcutHint}>
          <ShortcutRecorder value={g.islandShortcut} onChange={(islandShortcut) => set({ islandShortcut })} />
        </Row>
        <Row title={t.fullscreen} description={t.fullscreenHint}>
          <Toggle label={t.fullscreen} on={g.hideInFullscreen} onChange={(on) => set({ hideInFullscreen: on })} />
        </Row>
        <Row title={t.motion} description={t.motionHint}>
          <Choice
            value={g.motion}
            onChange={(motion) => set({ motion })}
            options={[
              { value: "system", label: t.motions.system },
              { value: "reduced", label: t.motions.reduced },
              { value: "full", label: t.motions.full },
            ]}
          />
        </Row>
      </Group>
    </>
  );
}

function Grip() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {[6, 12, 18].map((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
    </svg>
  );
}

/** The island's tabs: dragged into order, each shown or hidden. Home stays first. */
function Tabs({ settings, save }: { settings: Settings; save: ReturnType<typeof useSave>["save"] }) {
  const messages = useT();
  const t = messages.settings.tabs;
  const saved = settings.tabs.order.join();
  const arrange = () => orderTabs(settings.tabs.order).map((def) => def.id).filter((id) => id !== "home");
  const [order, setOrder] = useState<Tab[]>(arrange);
  const latest = useRef(order);
  latest.current = order;
  // Changed elsewhere (another window): follow.
  useEffect(() => setOrder(arrange()), [saved]);
  const hidden = settings.tabs.hidden;
  const commit = () =>
    save((s) => {
      // Ids this version does not know (a plugin's) keep their place at the end.
      const unknown = s.tabs.order.filter((id) => !TABS.some((def) => def.id === id));
      return { ...s, tabs: { ...s.tabs, order: ["home", ...latest.current, ...unknown] } };
    });
  const show = (id: Tab, on: boolean) =>
    save((s) => {
      const others = s.tabs.hidden.filter((h) => h !== id);
      return { ...s, tabs: { ...s.tabs, hidden: on ? others : [...others, id] } };
    });
  return (
    <>
      <Group>
        <div className="tab-row tab-row--fixed">
          <span className="tab-row-grip" />
          <span className="tab-row-icon">{tabFace("home", messages.tabs, false).icon}</span>
          <div className="row-text">
            <div className="row-title">{t.home}</div>
            <div className="row-desc">{t.homeHint}</div>
          </div>
        </div>
        <Reorder.Group axis="y" values={order} onReorder={setOrder} className="tab-list">
          {order.map((id) => {
            const def = TABS.find((d) => d.id === id)!;
            const { label, icon } = tabFace(id, messages.tabs, false);
            const on = !hidden.includes(id);
            return (
              <Reorder.Item key={id} value={id} className="tab-row" onDragEnd={commit} whileDrag={{ scale: 1.02, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", zIndex: 1 }}>
                <span className="tab-row-grip" title={t.drag}>
                  <Grip />
                </span>
                <span className={`tab-row-icon ${on ? "" : "tab-row-icon--off"}`}>{icon}</span>
                <div className="row-text">
                  <div className="row-title">{label}</div>
                  <div className="row-desc">{def.when === "always" ? t.always : t.content}</div>
                </div>
                <Toggle label={t.show(label)} on={on} onChange={(next) => show(id, next)} />
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      </Group>
      <p className="tab-hint">{t.hint}</p>
    </>
  );
}

/** A secret link, recognisable but not shown whole: "Google · …a1b2". */
function linkLabel(link: string): string {
  let host = "";
  try {
    host = new URL(link.replace(/^webcal:/i, "https:")).hostname;
  } catch {
    return "…";
  }
  const name = host.includes("google.") ? "Google" : host.includes("outlook.") || host.includes("office365.") ? "Outlook" : host.includes("icloud.") ? "iCloud" : host;
  const end = link.replace(/\.ics$/i, "").slice(-4);
  return `${name} · …${end}`;
}

/** The calendars (secret iCal links) and the reminder. */
function Calendar({ settings, save }: { settings: Settings; save: ReturnType<typeof useSave>["save"] }) {
  const t = useT().settings.calendar;
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const links = settings.calendar.links;
  const add = () => {
    const value = link.trim();
    if (!value || busy) return;
    if (links.includes(value)) {
      setMessage({ ok: false, text: t.already });
      return;
    }
    setBusy(true);
    setMessage(null);
    checkCalendarLink(value)
      .then((check) => {
        save((s) => ({ ...s, calendar: { ...s.calendar, links: [...s.calendar.links, value] } }));
        setLink("");
        setMessage({ ok: true, text: t.added(check.name, check.upcoming) });
      })
      .catch((e) => setMessage({ ok: false, text: t.failed(String(e)) }))
      .finally(() => setBusy(false));
  };
  const remove = (gone: string) => save((s) => ({ ...s, calendar: { ...s.calendar, links: s.calendar.links.filter((l) => l !== gone) } }));
  return (
    <>
      <Group>
        <Row title={t.links} description={t.linksHint} stacked>
          <div className="cal-add">
            <input
              className="input"
              value={link}
              placeholder={t.placeholder}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
              }}
            />
            <button className="button button--main" disabled={busy || !link.trim()} onClick={add}>
              {busy ? t.checking : t.add}
            </button>
          </div>
          {message && <div className={`cal-message ${message.ok ? "" : "cal-message--error"}`}>{message.text}</div>}
          {links.length > 0 && (
            <div className="cal-links">
              {links.map((l) => (
                <div key={l} className="cal-link">
                  <span className="cal-link-name">📅 {linkLabel(l)}</span>
                  <button className="cal-link-remove" onClick={() => remove(l)}>
                    {t.remove}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Row>
        <Row title={t.remind} description={t.remindHint}>
          <Choice
            value={String(settings.calendar.remindMinutes)}
            onChange={(v) => save((s) => ({ ...s, calendar: { ...s.calendar, remindMinutes: Number(v) } }))}
            options={["5", "10", "15"].map((v) => ({ value: v, label: t.minutes(Number(v)) }))}
          />
        </Row>
      </Group>
      <Group title={t.how}>
        <div className="cal-help">
          <p>{t.google}</p>
          <p>{t.outlook}</p>
          <p>{t.icloud}</p>
          <p className="cal-help-secret">{t.secret}</p>
        </div>
      </Group>
    </>
  );
}

/** AI agents: hooking Quiera into Claude Code, or out; answering from the island. */
function Agents({ settings, save }: { settings: Settings; save: ReturnType<typeof useSave>["save"] }) {
  const t = useT().settings.agents;
  const [status, setStatus] = useState<AgentsStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getAgentsStatus().then(setStatus).catch(ignore);
  }, []);
  const claude = status?.claude;
  const codex = status?.codex;
  const change = (agent: "claude" | "codex", on: boolean) => {
    setBusy(true);
    setError(null);
    // Chosen here: the island no longer needs to offer it.
    if (agent === "claude" && !settings.agents.claudeAsked) save((s) => ({ ...s, agents: { ...s.agents, claudeAsked: true } }));
    connectAgent(agent, on)
      .then(setStatus)
      .catch((e) => setError(String(e)))
      .finally(() => setBusy(false));
  };
  const unusable = (s: HookStatus | undefined) => !s || s === "missing" || s === "unreadable";
  const claudeNote = claude === "missing" ? t.missing : claude === "unreadable" ? t.unreadable : claude === "on" ? t.restart : null;
  const codexNote = codex === "missing" ? t.codexMissing : codex === "unreadable" ? t.unreadable : null;
  const any = claude === "on" || codex === "on";
  return (
    <>
      <Group>
        <Row
          title={t.claude}
          description={
            <>
              {t.claudeHint}
              {claudeNote && <span className="agents-note">{claudeNote}</span>}
            </>
          }
          disabled={unusable(claude)}
        >
          <Toggle on={claude === "on"} onChange={(on) => change("claude", on)} label={t.claude} disabled={busy || unusable(claude)} />
        </Row>
        <Row
          title={t.codex}
          description={
            <>
              {t.codexHint}
              {codexNote && <span className="agents-note">{codexNote}</span>}
            </>
          }
          disabled={unusable(codex)}
        >
          <Toggle on={codex === "on"} onChange={(on) => change("codex", on)} label={t.codex} disabled={busy || unusable(codex)} />
        </Row>
        {error && <div className="agents-note agents-note--error agents-error">{t.failed(error)}</div>}
      </Group>
      <Group>
        <Row title={t.approve} description={t.approveHint} disabled={!any}>
          <Toggle
            on={settings.agents.approve}
            onChange={(approve) => save((s) => ({ ...s, agents: { ...s.agents, approve } }))}
            label={t.approve}
            disabled={!any}
          />
        </Row>
        <Row title={t.sound} description={t.soundHint}>
          <Toggle on={settings.agents.sound} onChange={(sound) => save((s) => ({ ...s, agents: { ...s.agents, sound } }))} label={t.sound} />
        </Row>
        <Row title={t.usage} description={t.usageHint}>
          <Toggle on={settings.agents.usage} onChange={(usage) => save((s) => ({ ...s, agents: { ...s.agents, usage } }))} label={t.usage} />
        </Row>
      </Group>
      <Group>
        <Row title={t.phone} description={t.phoneHint} stacked disabled={!any}>
          <PhonePairing disabled={!any} />
        </Row>
      </Group>
      <Group>
        <div className="cal-help">
          <p>{t.open}</p>
          <p>{t.launchHow}</p>
          <p>{t.privacy}</p>
        </div>
      </Group>
    </>
  );
}

/** The QR code that links a phone to the agents' page, and a way to unlink it. */
function PhonePairing({ disabled }: { disabled: boolean }) {
  const t = useT().settings.agents;
  const [link, setLink] = useState<PhoneLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const show = () => {
    setError(null);
    startAgentsPhone()
      .then(setLink)
      .catch((e) => setError(String(e)));
  };
  const stop = () => {
    stopAgentsPhone().catch(ignore);
    setLink(null);
  };
  if (!link)
    return (
      <div className="phone-pair">
        <button className="button button--main" disabled={disabled} onClick={show}>
          {t.phoneShow}
        </button>
        {error && <div className="agents-note agents-note--error">{error}</div>}
      </div>
    );
  return (
    <div className="phone-pair">
      <svg className="phone-qr" viewBox={`-2 -2 ${link.qrSize + 4} ${link.qrSize + 4}`} role="img" aria-label="QR code">
        <rect x="-2" y="-2" width={link.qrSize + 4} height={link.qrSize + 4} fill="#fff" />
        <path d={link.qrPath} fill="#000" />
      </svg>
      <div className="phone-side">
        <code className="phone-url">{link.url}</code>
        <p>{t.phoneOpen}</p>
        <button className="button" onClick={stop}>
          {t.phoneStop}
        </button>
      </div>
    </div>
  );
}

function Launcher({ settings, save }: { settings: Settings; save: ReturnType<typeof useSave>["save"] }) {
  const messages = useT();
  const t = messages.settings.launcher;
  const label = messages.shortcut;
  const l = settings.launcher;
  const [held, setHeld] = useState<Shortcut | null>(null);
  useEffect(() => {
    // The backend applies a new shortcut first: read what it holds after.
    const timer = setTimeout(() => getHeldShortcut().then(setHeld).catch(ignore), 250);
    return () => clearTimeout(timer);
  }, [l.enabled, l.shortcut]);
  const set = (patch: Partial<Settings["launcher"]>) => save((s) => ({ ...s, launcher: { ...s.launcher, ...patch } }));
  const taken = l.enabled && held !== l.shortcut;
  return (
    <>
      <Group>
        <Row title={t.launcher} description={t.launcherHint}>
          <Toggle label={t.launcher} on={l.enabled} onChange={(on) => set({ enabled: on })} />
        </Row>
        <Row
          title={t.shortcut}
          stacked
          disabled={!l.enabled}
          description={
            taken ? (
              <span className="warn">
                {t.taken(label(l.shortcut))}
                {held ? t.takenUsing(label(held)) : t.takenNone}
              </span>
            ) : (
              t.shortcutHint
            )
          }
        >
          <Choice value={l.shortcut} disabled={!l.enabled} onChange={(shortcut) => set({ shortcut })} options={SHORTCUTS.map((s) => ({ value: s, label: label(s) }))} />
        </Row>
      </Group>
      <Group title={t.files}>
        <Row title={t.indexFiles} disabled={!l.enabled} description={t.indexFilesHint}>
          <Toggle label={t.indexFiles} on={l.indexFiles} disabled={!l.enabled} onChange={(on) => set({ indexFiles: on })} />
        </Row>
      </Group>
    </>
  );
}

function Media({ settings, save }: { settings: Settings; save: ReturnType<typeof useSave>["save"] }) {
  const t = useT().settings.media;
  const lang = useLang();
  const m = settings.media;
  const set = (patch: Partial<Settings["media"]>) => save((s) => ({ ...s, media: { ...s.media, ...patch } }));
  const seconds = (m.lyricsOffsetMs / 1000).toLocaleString(localeOf(lang), { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "exceptZero" });
  return (
    <Group>
      <Row title={t.lyrics} description={t.lyricsHint}>
        <Toggle label={t.lyrics} on={m.lyrics} onChange={(on) => set({ lyrics: on })} />
      </Row>
      <Row title={t.netease} disabled={!m.lyrics} description={t.neteaseHint}>
        <Toggle label={t.neteaseLabel} on={m.netease} disabled={!m.lyrics} onChange={(on) => set({ netease: on })} />
      </Row>
      <Row title={t.offset} disabled={!m.lyrics} description={t.offsetHint}>
        <div className="offset">
          <input
            className="range"
            type="range"
            min={-2000}
            max={2000}
            step={100}
            value={m.lyricsOffsetMs}
            disabled={!m.lyrics}
            style={{ "--fill": `${((m.lyricsOffsetMs + 2000) / 4000) * 100}%` } as React.CSSProperties}
            onChange={(e) => set({ lyricsOffsetMs: Number(e.target.value) })}
          />
          <span className="offset-value">{m.lyricsOffsetMs === 0 ? "0 s" : `${seconds} s`}</span>
          {m.lyricsOffsetMs !== 0 && (
            <button className="link" onClick={() => set({ lyricsOffsetMs: 0 })}>
              {t.reset}
            </button>
          )}
        </div>
      </Row>
    </Group>
  );
}

function Notifications({ settings, save }: { settings: Settings; save: ReturnType<typeof useSave>["save"] }) {
  const t = useT().settings.notifications;
  const n = settings.notifications;
  const set = (patch: Partial<Settings["notifications"]>) => save((s) => ({ ...s, notifications: { ...s.notifications, ...patch } }));
  return (
    <Group>
      <Row title={t.enabled} description={t.enabledHint}>
        <Toggle label={t.enabled} on={n.enabled} onChange={(on) => set({ enabled: on })} />
      </Row>
      <Row title={t.peek} disabled={!n.enabled} description={t.peekHint}>
        <Toggle label={t.peekLabel} on={n.peek} disabled={!n.enabled} onChange={(on) => set({ peek: on })} />
      </Row>
    </Group>
  );
}

function Clipboard({ settings, save }: { settings: Settings; save: ReturnType<typeof useSave>["save"] }) {
  const t = useT().settings.clipboard;
  return (
    <>
      <Group title={t.clipboard}>
        <Row title={t.history} description={t.historyHint}>
          <Toggle label={t.history} on={settings.clipboard.enabled} onChange={(on) => save((s) => ({ ...s, clipboard: { enabled: on } }))} />
        </Row>
      </Group>
      <Group title={t.shelf}>
        <Row title={t.keep} description={t.keepHint}>
          <Toggle label={t.keepLabel} on={settings.shelf.keep} onChange={(on) => save((s) => ({ ...s, shelf: { keep: on } }))} />
        </Row>
      </Group>
    </>
  );
}

function Peeks({ settings, save }: { settings: Settings; save: ReturnType<typeof useSave>["save"] }) {
  const t = useT().settings.peeks;
  const p = settings.peeks;
  const set = (patch: Partial<Settings["peeks"]>) => save((s) => ({ ...s, peeks: { ...s.peeks, ...patch } }));
  return (
    <Group>
      <Row title={t.power} description={t.powerHint}>
        <Toggle label={t.powerLabel} on={p.power} onChange={(on) => set({ power: on })} />
      </Row>
      <Row title={t.audio} description={t.audioHint}>
        <Toggle label={t.audioLabel} on={p.audioDevice} onChange={(on) => set({ audioDevice: on })} />
      </Row>
      <Row title={t.bluetooth} description={t.bluetoothHint}>
        <Toggle label={t.bluetoothLabel} on={p.bluetooth} onChange={(on) => set({ bluetooth: on })} />
      </Row>
      <Row title={t.caps} description={t.capsHint}>
        <Toggle label={t.capsLabel} on={p.capsLock} onChange={(on) => set({ capsLock: on })} />
      </Row>
      <Row title={t.volume} description={t.volumeHint}>
        <Toggle label={t.volumeLabel} on={p.volume} onChange={(on) => set({ volume: on })} />
      </Row>
    </Group>
  );
}

/** The update state, kept current by the backend's events. */
function useUpdateStatus(): UpdateStatus | null {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  useEffect(() => {
    let stop: (() => void) | undefined;
    onUpdateStatus(setStatus)
      .then((unlisten) => {
        stop = unlisten;
        return getUpdateStatus();
      })
      .then(setStatus)
      .catch(ignore);
    return () => stop?.();
  }, []);
  return status;
}

function Updates({ settings, save }: { settings: Settings; save: ReturnType<typeof useSave>["save"] }) {
  const t = useT().settings.updates;
  const status = useUpdateStatus();
  const [installError, setInstallError] = useState<string | null>(null);
  if (!status) return null;
  const busy = status.checking || status.installing;
  const text = status.installing
    ? t.installing
    : status.checking
      ? t.checking
      : status.available
        ? t.available(status.available)
        : t.upToDate;
  return (
    <Group title={t.title}>
      <Row title={text} description={installError ?? status.error ?? t.signed}>
        {status.available ? (
          <button
            className="button button--main"
            disabled={busy}
            onClick={() => {
              setInstallError(null);
              installUpdate().catch(() => setInstallError(t.installFailed));
            }}
          >
            {t.install}
          </button>
        ) : (
          <button className="button" disabled={busy} onClick={() => checkForUpdates().catch(ignore)}>
            {t.check}
          </button>
        )}
      </Row>
      <Row title={t.auto} description={t.autoHint}>
        <Toggle
          label={t.auto}
          on={settings.general.checkUpdates}
          onChange={(on) => save((s) => ({ ...s, general: { ...s.general, checkUpdates: on } }))}
        />
      </Row>
    </Group>
  );
}

/** Quiera's icon (`src-tauri/icons/source.svg`): the cloud of quiera.eu. */
function AppLogo() {
  return (
    <svg className="about-mark" viewBox="0 0 64 64" role="img" aria-label="Quiera">
      <g fill="#7136ff">
        <circle cx="32.2" cy="26.9" r="16.6" />
        <circle cx="17.7" cy="36.5" r="13.7" />
        <circle cx="46.3" cy="36.5" r="13.7" />
        <ellipse cx="32" cy="42" rx="17" ry="13.3" />
      </g>
      <g fill="#fff">
        <rect x="21.9" y="26.8" width="7.8" height="14" rx="3.9" transform="rotate(-9 25.8 33.8)" />
        <rect x="34.6" y="23.7" width="7.8" height="14" rx="3.9" transform="rotate(-9 38.5 30.7)" />
      </g>
    </svg>
  );
}

function About({ settings, save }: { settings: Settings; save: ReturnType<typeof useSave>["save"] }) {
  const t = useT().settings.about;
  const status = useUpdateStatus();
  return (
    <div className="about">
      <AppLogo />
      <div className="about-name">Quiera</div>
      <div className="about-version">{t.version(status?.current ?? "")}</div>
      <p className="about-text">{t.text}</p>
      <div className="about-links">
        <button className="button" onClick={() => openLink(REPO).catch(ignore)}>
          {t.source}
        </button>
        <button className="button" onClick={() => openLink(`${REPO}/issues`).catch(ignore)}>
          {t.report}
        </button>
      </div>
      <div className="about-updates">
        <Updates settings={settings} save={save} />
      </div>
    </div>
  );
}

const isSection = (s: string): s is Section => SECTIONS.some((x) => x.id === s);

/**
 * The window's own title bar: drag it to move the window; minimize (to the
 * taskbar) and close, nothing else.
 */
function TitleBar({ title }: { title: string }) {
  const t = useT().settings;
  const win = getCurrentWindow();
  return (
    <header className="titlebar" data-tauri-drag-region>
      <span className="titlebar-logo" data-tauri-drag-region aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 64 64">
          <g fill="#7136ff">
            <circle cx="32.2" cy="26.9" r="16.6" />
            <circle cx="17.7" cy="36.5" r="13.7" />
            <circle cx="46.3" cy="36.5" r="13.7" />
            <ellipse cx="32" cy="42" rx="17" ry="13.3" />
          </g>
        </svg>
      </span>
      <span className="titlebar-title" data-tauri-drag-region>
        {title}
      </span>
      <button className="titlebar-button" aria-label={t.minimize} title={t.minimize} onClick={() => win.minimize().catch(ignore)}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M1 5h8" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      <button className="titlebar-button titlebar-button--close" aria-label={t.close} title={t.close} onClick={() => win.close().catch(ignore)}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="m1.5 1.5 7 7m0-7-7 7" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
    </header>
  );
}

export function SettingsApp() {
  const settings = useSettings();
  const { save, error } = useSave();
  // Opened on a section ("#about", from the tray's update item) or told to show one.
  const [section, setSection] = useState<Section>(() => {
    const asked = location.hash.slice(1);
    return isSection(asked) ? asked : "general";
  });
  useEffect(() => {
    const stop = listen<string>("settings://section", (e) => isSection(e.payload) && setSection(e.payload));
    return () => {
      stop.then((unlisten) => unlisten()).catch(ignore);
    };
  }, []);
  const t = useT().settings;
  // The window's title follows the language.
  useEffect(() => {
    document.title = t.windowTitle;
  }, [t.windowTitle]);

  return (
    <div className="window">
      <TitleBar title="Quiera" />
      <div className="app">
      <nav className="nav">
        <div className="nav-title">{t.windowTitle}</div>
        {SECTIONS.map((s) => (
          <button key={s.id} className={`nav-item ${s.id === section ? "nav-item--on" : ""}`} onClick={() => setSection(s.id)}>
            {s.id === section && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: "spring", stiffness: 550, damping: 42 }} />}
            <span className="nav-icon">{s.icon}</span>
            <span className="nav-label">{t.sections[s.id]}</span>
          </button>
        ))}
      </nav>
      <main className="main">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={section} className="page" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
            {section !== "about" && <h1 className="page-title">{t.sections[section]}</h1>}
            {section === "general" && <General settings={settings} save={save} />}
            {section === "tabs" && <Tabs settings={settings} save={save} />}
            {section === "calendar" && <Calendar settings={settings} save={save} />}
            {section === "agents" && <Agents settings={settings} save={save} />}
            {section === "launcher" && <Launcher settings={settings} save={save} />}
            {section === "media" && <Media settings={settings} save={save} />}
            {section === "notifications" && <Notifications settings={settings} save={save} />}
            {section === "clipboard" && <Clipboard settings={settings} save={save} />}
            {section === "peeks" && <Peeks settings={settings} save={save} />}
            {section === "about" && <About settings={settings} save={save} />}
          </motion.div>
        </AnimatePresence>
        {error && <div className="error">{t.saveError(error)}</div>}
      </main>
      </div>
    </div>
  );
}
