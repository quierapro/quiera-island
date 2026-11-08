import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  agentKeyboard,
  decideAgent,
  focusAgent,
  openAgentStep,
  type AgentAction,
  type AgentDecision,
  type AgentPick,
  type AgentSession,
  type AgentUsage,
} from "../../ipc/agents";
import type { Size } from "../../island/geometry";
import { useT } from "../../i18n";
import { RING_IN_PILL_FROM, describe, fullest, minutesSince, needsYou, requestLine, span, stepKind, stepText, usageTone } from "./format";
import { useAgentsNow } from "./store";
import "./agents.css";

const ignore = () => {};

/** The closed island while an agent works, or waits. */
export const AGENTS_ACTIVITY_SIZE: Size = [320, 34, 17];
/** The peek when one finishes, or starts to wait. */
export const AGENTS_PEEK_SIZE: Size = [380, 52, 24];
/** A permission asked: what, and the answers. */
export const AGENTS_REQUEST_SIZE: Size = [460, 122, 28];
/** Claude Code found running: listen to it? */
export const AGENTS_OFFER_SIZE: Size = [430, 56, 26];
/** How long "Allow" is held for a risky command. */
const HOLD_MS = 900;

type T = ReturnType<typeof useT>["agents"];

/** A four-pointed spark: an AI at work. */
export function AgentsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3c.6 4.6 3.4 7.4 8 8-4.6.6-7.4 3.4-8 8-.6-4.6-3.4-7.4-8-8 4.6-.6 7.4-3.4 8-8Z" />
    </svg>
  );
}

const glyph = (d: ReactNode, size = 14) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const TerminalIcon = () => glyph(<path d="m5 7 5 5-5 5M12 17h7" />);
const OpenIcon = () => glyph(<path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" />, 13);
const KeyboardIcon = () => glyph(<path d="M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M8 14h8" />);

/** Each kind of step's icon: a file, a page, a search, a command. */
const STEP_ICONS: Record<ReturnType<typeof stepKind>, ReactNode> = {
  file: glyph(
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
    </>,
  ),
  page: glyph(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.6 3.5 5.4 3.5 8.5s-1.1 5.9-3.5 8.5c-2.4-2.6-3.5-5.4-3.5-8.5s1.1-5.9 3.5-8.5Z" />
    </>,
  ),
  search: glyph(
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>,
  ),
  command: glyph(<path d="m5 7 5 5-5 5M12 17h7" />),
  other: glyph(<path d="M12 4c.5 3.8 2.6 5.9 6.5 6.5-3.9.6-6 2.7-6.5 6.5-.5-3.8-2.6-5.9-6.5-6.5 3.9-.6 6-2.7 6.5-6.5Z" />),
};

/** The state's colour, as a class. */
const tone = (s: AgentSession) => `agent--${needsYou(s) ? "waiting" : s.state}`;

/** Brings the session's window back, if it can. */
const focus = (s: AgentSession) => {
  if (s.canFocus) focusAgent(s.id).catch(ignore);
};

/** A click inside the island that must not also open it. */
const press = (run: () => void) => (e: React.MouseEvent) => {
  e.stopPropagation();
  run();
};

/** How much of a usage limit is used: a ring that fills, calm, then orange, then red. */
export function UsageRing({ used, size = 18 }: { used: number; size?: number }) {
  const stroke = size >= 18 ? 2.6 : 2.2;
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  const filled = Math.min(100, Math.max(0, used)) / 100;
  return (
    <svg className={`usage-ring usage-ring--${usageTone(used)}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className="usage-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
      <circle
        className="usage-ring-fill"
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${length * filled} ${length}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

/** Every limit of an AI, one line each, for its tooltip. */
function usageDetails(u: AgentUsage, t: T, now: number): string {
  const lines = u.windows.map((w) => {
    const parts = [t.usage(Math.round(w.used), t.window(w.minutes))];
    if (w.resetsAt) parts.push(t.resetsIn(span((w.resetsAt * 1000 - now) / 60_000, t.dayUnit)));
    if (w.fullIn) parts.push(t.fullIn(span(w.fullIn, t.dayUnit)));
    return parts.join(" · ");
  });
  const age = (now - u.updated) / 60_000;
  if (u.updated && age > 15) lines.push(t.heardAgo(span(age, t.dayUnit)));
  return lines.join("\n");
}

/** The closed island: what the lead session does, since when; a ring only when its AI's limit nears. */
export function AgentsActivity({ session, more, usage }: { session: AgentSession; more: number; usage?: AgentUsage }) {
  const t = useT().agents;
  const now = useAgentsNow();
  const limit = fullest(usage);
  return (
    <div className={`agent-activity ${tone(session)}`}>
      <span className="agent-icon">
        <AgentsIcon size={15} />
      </span>
      <span className="agent-activity-text">{describe(session, t)}</span>
      {limit && limit.used >= RING_IN_PILL_FROM && (
        <span className="agent-activity-usage" title={t.usage(Math.round(limit.used), t.window(limit.minutes))}>
          <UsageRing used={limit.used} size={14} />
        </span>
      )}
      <span className="agent-activity-side">{more > 0 ? `+${more}` : needsYou(session) ? session.project : t.duration(minutesSince(session.since, now))}</span>
    </div>
  );
}

/** The top of the agents tab: each AI's fullest limit, a ring and a percentage; the rest in its tooltip. */
export function UsageRow({ usage }: { usage: readonly AgentUsage[] }) {
  const t = useT().agents;
  const now = useAgentsNow();
  return (
    <div className="usage-row">
      {usage.map((u) => {
        const w = fullest(u);
        if (!w) return null;
        const soon = u.windows.map((x) => x.fullIn).filter((x): x is number => x != null);
        return (
          <span key={u.agent} className="usage-agent" title={usageDetails(u, t, now)}>
            <span className="usage-name">{t.name(u.agent)}</span>
            <UsageRing used={w.used} size={16} />
            <span className="usage-percent">{Math.round(w.used)} %</span>
            <span className="usage-length">{t.window(w.minutes)}</span>
            {soon.length > 0 && <span className="usage-soon">{t.fullIn(span(Math.min(...soon), t.dayUnit))}</span>}
          </span>
        );
      })}
    </div>
  );
}

/** "Allow" held down for a moment: a risky command is never allowed by a slip. */
function HoldButton({ label, onDone }: { label: string; onDone(): void }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const stop = () => {
    clearTimeout(timer.current);
    setHolding(false);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      className={`agent-button agent-button--danger ${holding ? "agent-button--holding" : ""}`}
      style={{ "--hold": `${HOLD_MS}ms` } as React.CSSProperties}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.stopPropagation();
        setHolding(true);
        timer.current = window.setTimeout(() => {
          setHolding(false);
          onDone();
        }, HOLD_MS);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
    >
      <span className="agent-hold-fill" aria-hidden="true" />
      <span className="agent-hold-label">{label}</span>
    </button>
  );
}

/** The answers to a permission: deny, the terminal, always (when offered), allow. */
function Answers({ session }: { session: AgentSession }) {
  const t = useT().agents;
  const request = session.request;
  if (!request) return null;
  const answer = (decision: AgentDecision, always = false) => decideAgent(request.id, decision, undefined, always).catch(ignore);
  return (
    <div className="agent-answers">
      <button className="agent-button" onClick={press(() => answer("deny"))}>
        {t.deny}
      </button>
      <button className="agent-button agent-button--icon" title={t.terminalHint} aria-label={t.terminalHint} onClick={press(() => answer("terminal"))}>
        <TerminalIcon />
      </button>
      {request.always && !request.danger && (
        <button className="agent-button" title={t.alwaysHint} onClick={press(() => answer("allow", true))}>
          {t.always}
        </button>
      )}
      {request.danger ? (
        <HoldButton label={t.hold} onDone={() => answer("allow")} />
      ) : (
        <button className="agent-button agent-button--main" onClick={press(() => answer("allow"))}>
          {t.allow}
        </button>
      )}
    </div>
  );
}

/** Who asks: the spark, the agent and its project, and what it wants. */
function RequestHead({ session, aside, danger = false }: { session: AgentSession; aside: string; danger?: boolean }) {
  const t = useT().agents;
  return (
    <div className="agent-request-head">
      <span className="agent-icon">
        <AgentsIcon size={15} />
      </span>
      <span className="agent-request-who">
        {t.name(session.agent)} · {session.project}
      </span>
      <span className={`agent-request-verb ${danger ? "agent-request-verb--danger" : ""}`}>{aside}</span>
    </div>
  );
}

/** A permission asked while its user was away: what (the command, the change, the plan), and the answers. */
export function AgentsRequest({ session }: { session: AgentSession }) {
  const t = useT().agents;
  const request = session.request;
  if (!request) return null;
  const line = requestLine(request, t.request);
  const plan = request.tool === "ExitPlanMode" && request.detail;
  return (
    <div className={`agent-request ${request.danger ? "agent--danger" : "agent--waiting"}`}>
      <RequestHead session={session} aside={request.danger ? `${t.danger} · ${line.verb}` : line.verb} danger={request.danger} />
      {plan ? (
        <div className="agent-request-plan" onClick={(e) => e.stopPropagation()}>
          {request.detail}
        </div>
      ) : (
        (line.what || line.size) && (
          <div className="agent-request-what" title={line.what ?? undefined}>
            {line.what && <code>{line.what}</code>}
            {line.size && <span className="agent-request-size">{line.size}</span>}
          </div>
        )
      )}
      {!plan && request.diff && (
        <div className="agent-diff" onClick={(e) => e.stopPropagation()}>
          {request.diff.map((l, i) => (
            <div key={i} className={`agent-diff-line agent-diff-line--${l.kind === "+" ? "add" : l.kind === "-" ? "del" : "same"}`}>
              <span className="agent-diff-sign">{l.kind}</span>
              <span className="agent-diff-text">{l.text || " "}</span>
            </div>
          ))}
        </div>
      )}
      <Answers session={session} />
    </div>
  );
}

/**
 * A question Claude asks: one at a time, its options to pick (several where
 * it allows), or a typed answer; then the answers go back to Claude as if
 * given in the terminal.
 */
export function AgentsQuestion({ session }: { session: AgentSession }) {
  const t = useT().agents;
  const request = session.request;
  const questions = request?.questions ?? [];
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<AgentPick[]>(() => questions.map(() => []));
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  // The island takes the keyboard while an answer is typed, and gives it back after.
  useEffect(() => {
    if (!typing) return;
    agentKeyboard(true).catch(ignore);
    requestAnimationFrame(() => input.current?.focus());
    return () => {
      agentKeyboard(false).catch(ignore);
    };
  }, [typing]);
  if (!request || questions.length === 0) return null;
  const question = questions[Math.min(at, questions.length - 1)];
  const mine = Array.isArray(picked[at]) ? (picked[at] as number[]) : [];
  const last = at === questions.length - 1;
  const send = (all: AgentPick[]) => decideAgent(request.id, "allow", all).catch(ignore);
  const answerWith = (answer: AgentPick) => {
    const next = picked.map((p, i) => (i === at ? answer : p));
    setPicked(next);
    if (last) send(next);
    else setAt(at + 1);
  };
  const pick = (index: number) =>
    press(() => {
      if (!question.multiSelect) return answerWith([index]);
      setPicked(picked.map((p, i) => (i !== at ? p : mine.includes(index) ? mine.filter((x) => x !== index) : [...mine, index])));
    });
  const typed = () => {
    const value = text.trim();
    if (!value) return;
    setTyping(false);
    setText("");
    answerWith(value);
  };
  return (
    <div className="agent-request agent-question agent--waiting">
      <RequestHead
        session={session}
        aside={questions.length > 1 ? t.question(at + 1, questions.length) : question.multiSelect ? t.several : (question.header ?? t.asks)}
      />
      <div className="agent-question-text">{question.question}</div>
      {typing ? (
        <form
          className="agent-type"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            typed();
          }}
        >
          <input
            ref={input}
            className="agent-type-input"
            value={text}
            placeholder={t.typeAnswer}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setTyping(false);
            }}
          />
        </form>
      ) : (
        <div className="agent-options" role={question.multiSelect ? "group" : "radiogroup"}>
          {question.options.map((o, i) => (
            <button
              key={o.label}
              role={question.multiSelect ? "checkbox" : "radio"}
              aria-checked={mine.includes(i)}
              className={`agent-option ${mine.includes(i) ? "agent-option--on" : ""}`}
              title={o.description}
              onClick={pick(i)}
            >
              {question.multiSelect && <span className="agent-check" aria-hidden="true" />}
              <span className="agent-option-label">{o.label}</span>
              {o.description && <span className="agent-option-desc">{o.description}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="agent-answers">
        {typing ? (
          <>
            <button className="agent-button" onClick={press(() => setTyping(false))}>
              {t.cancel}
            </button>
            <button className="agent-button agent-button--main" disabled={!text.trim()} onClick={press(typed)}>
              {last ? t.send : t.next}
            </button>
          </>
        ) : (
          <>
            <button className="agent-button" onClick={press(() => decideAgent(request.id, "deny").catch(ignore))}>
              {t.skip}
            </button>
            <button className="agent-button" onClick={press(() => setTyping(true))}>
              <KeyboardIcon />
              {t.other}
            </button>
            <button className="agent-button agent-button--icon" title={t.terminalHint} aria-label={t.terminalHint} onClick={press(() => decideAgent(request.id, "terminal").catch(ignore))}>
              <TerminalIcon />
            </button>
            {question.multiSelect && (
              <button className="agent-button agent-button--main" disabled={mine.length === 0} onClick={press(() => answerWith(mine))}>
                {last ? t.send : t.next}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** A session that has just finished, or has just started to wait: a click brings its window back. */
export function AgentsPeek({ session }: { session: AgentSession }) {
  const t = useT().agents;
  return (
    <div className={`agent-peek ${tone(session)} ${session.canFocus ? "agent-peek--link" : ""}`} title={session.canFocus ? t.open : undefined} onClick={session.canFocus ? press(() => focus(session)) : undefined}>
      <span className="agent-peek-icon">
        <AgentsIcon size={18} />
      </span>
      <span className="agent-peek-text">
        <span className="agent-peek-title">
          {t.name(session.agent)} · {session.project}
        </span>
        <span className="agent-peek-state">{session.state === "question" ? t.asks : describe(session, t)}</span>
      </span>
      {session.canFocus && (
        <span className="agent-peek-go" aria-hidden="true">
          <TerminalIcon />
        </span>
      )}
    </div>
  );
}

/** Claude Code found running: an offer to follow it, answered once. */
export function AgentsOffer({ state, onConnect, onLater }: { state: "ask" | "done" | "failed"; onConnect(): void; onLater(): void }) {
  const t = useT().agents;
  return (
    <div className="agent-offer agent--working">
      <span className="agent-peek-icon">
        <AgentsIcon size={18} />
      </span>
      <span className="agent-peek-text">
        <span className="agent-peek-title">{t.offerTitle}</span>
        <span className="agent-offer-text">{state === "done" ? t.offerDone : state === "failed" ? t.offerFailed : t.offerText}</span>
      </span>
      {state === "ask" && (
        <span className="agent-answers agent-answers--compact">
          <button className="agent-button" onClick={press(onLater)}>
            {t.offerLater}
          </button>
          <button className="agent-button agent-button--main" onClick={press(onConnect)}>
            {t.offerConnect}
          </button>
        </span>
      )}
    </div>
  );
}

/** One step of a session: the whole line opens what it worked on, when it can. */
function Step({ session, step, index }: { session: AgentSession; step: AgentAction; index: number }) {
  const t = useT().agents;
  const kind = stepKind(step);
  const opens = Boolean(step.link) && (kind === "file" || kind === "page" || kind === "search");
  const label = kind === "page" ? t.openLink : kind === "search" ? t.search : t.openFile;
  return (
    <div
      className={`agent-step ${step.failed ? "agent-step--failed" : ""} ${opens ? "agent-step--link" : ""}`}
      title={opens ? `${label} · ${step.link}` : (step.target ?? undefined)}
      onClick={opens ? press(() => openAgentStep(session.id, index).catch(ignore)) : (e) => e.stopPropagation()}
    >
      <span className="agent-step-icon">{STEP_ICONS[kind]}</span>
      <span className="agent-step-text">{stepText(step, t)}</span>
      {step.failed && <span className="agent-step-failed">{t.stepFailed}</span>}
      {opens && (
        <span className="agent-step-open" aria-hidden="true">
          <OpenIcon />
        </span>
      )}
    </div>
  );
}

/**
 * The agents tab: each AI's limits; a row per session, in the order they
 * started; under the one in focus (hovered, else the newest), how full its
 * context is and its latest steps.
 */
export function AgentsPanel({
  rows,
  focusId,
  steps,
  usage,
  onFocus,
  onShow,
}: {
  rows: readonly AgentSession[];
  focusId: string | null;
  steps: number;
  /** Each AI's limits, shown above the sessions. */
  usage: readonly AgentUsage[];
  onFocus(id: string): void;
  /** A permission or a question waits: show its card (the island closes on it). */
  onShow(): void;
}) {
  const t = useT().agents;
  const now = useAgentsNow();
  if (rows.length === 0 && usage.length === 0) return <div className="agent-empty">{t.empty}</div>;
  return (
    <div className="agent-panel">
      {usage.length > 0 && <UsageRow usage={usage} />}
      {rows.length === 0 && <div className="agent-empty agent-empty--short">{t.empty}</div>}
      {rows.map((s) => {
        const open = s.id === focusId;
        return (
          <div key={s.id} className={`agent-session ${open ? "agent-session--open" : ""}`} onPointerEnter={() => onFocus(s.id)}>
            <div className={`agent-row ${tone(s)} ${s.canFocus ? "agent-row--link" : ""}`} title={s.canFocus ? t.open : undefined} onClick={s.canFocus ? press(() => focus(s)) : (e) => e.stopPropagation()}>
              <span className="agent-dot" />
              <span className="agent-text">
                <span className="agent-title">
                  {s.project}
                  <span className="agent-name">{t.name(s.agent)}</span>
                </span>
                <span className="agent-sub">{s.request ? requestSummary(s, t) : describe(s, t)}</span>
              </span>
              {s.request ? (
                <button className="agent-button agent-button--main agent-button--small" onClick={press(onShow)}>
                  {t.show}
                </button>
              ) : (
                <span className="agent-time">{t.duration(minutesSince(s.since, now))}</span>
              )}
            </div>
            {open && (s.context != null || steps > 0) && (
              <div className="agent-steps">
                {s.context != null && (
                  <div className="agent-step agent-context">
                    <span className="agent-step-icon">
                      <UsageRing used={s.context} size={13} />
                    </span>
                    <span className="agent-step-text">{t.context(Math.round(s.context))}</span>
                  </div>
                )}
                {s.recent.slice(0, steps).map((step, i) => (
                  <Step key={`${step.at}:${i}`} session={s} step={step} index={i} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** "Lancer git push --force", on one line; a question, as asked. */
function requestSummary(s: AgentSession, t: T): string {
  const request = s.request!;
  if (request.questions) return request.questions[0].question;
  const line = requestLine(request, t.request);
  return [line.verb, line.what, line.size].filter(Boolean).join(" ");
}
