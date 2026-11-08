import { describe as group, expect, it } from "vitest";
import type { AgentSession } from "../../ipc/agents";
import { fr } from "../../i18n/fr";
import { agentNews, agentsLayout, span, describe, diffCardSize, fullest, leadSession, questionCardSize, requestLine, sortSessions, stepKind, stepText, usageTone } from "./format";

const session = (id: string, state: AgentSession["state"], since = 0, tool: string | null = null, target: string | null = null): AgentSession => ({
  id,
  agent: "claude",
  project: "quiera",
  state,
  tool,
  target,
  since,
  request: null,
  canFocus: false,
  recent: [],
  created: since,
  context: null,
});

group("leadSession", () => {
  it("shows the one that needs its user before the ones at work", () => {
    const lead = leadSession([session("a", "working", 5), session("b", "waiting", 9), session("c", "done")]);
    expect(lead?.session.id).toBe("b");
    expect(lead?.more).toBe(1);
  });

  it("shows nothing when no session is active", () => {
    expect(leadSession([session("a", "done"), session("b", "ready")])).toBeNull();
  });
});

group("agentNews", () => {
  it("announces a finished session, and one starting to wait first", () => {
    const before = [session("a", "working"), session("b", "working")];
    expect(agentNews(before, [session("a", "done"), session("b", "working")])).toMatchObject({ kind: "done" });
    expect(agentNews(before, [session("a", "done"), session("b", "waiting")])).toMatchObject({ kind: "waiting", session: { id: "b" } });
  });

  it("does not announce what it never saw change", () => {
    expect(agentNews([], [session("a", "done")])).toBeNull();
    expect(agentNews([session("a", "done")], [session("a", "done")])).toBeNull();
  });
});

group("describe", () => {
  it("says what the tool does to what", () => {
    expect(describe(session("a", "working", 0, "Edit", "auth.ts"), fr.agents)).toBe("Modifie auth.ts");
    expect(describe(session("a", "working", 0, "SomeNewTool", "x"), fr.agents)).toBe("Travaille");
    expect(describe(session("a", "question", 0, "AskUserQuestion", "Staging ?"), fr.agents)).toBe("Staging ?");
    expect(describe(session("a", "waiting", 0, "Bash", "npm test"), fr.agents)).toBe("Attend ton accord : Lance npm test");
    expect(describe(session("a", "waiting"), fr.agents)).toBe("Attend ton accord");
  });
});

it("keeps the sessions in the order they started, the newest first", () => {
  const sorted = sortSessions([session("a", "done", 9), session("b", "working", 1), session("c", "question", 5)]);
  expect(sorted.map((s) => s.id)).toEqual(["a", "c", "b"]);
});

group("requestLine", () => {
  const request = { id: 1, tool: "Bash", target: "git push", detail: "git push --force origin main", added: null, removed: null, questions: null, diff: null, always: false, danger: false };
  it("shows the whole command to run", () => {
    expect(requestLine(request, fr.agents.request)).toEqual({ verb: "Lancer", what: "git push --force origin main", size: null });
  });
  it("shows an edit's size", () => {
    expect(requestLine({ ...request, tool: "Edit", target: "auth.ts", detail: null, added: 3, removed: 1 }, fr.agents.request)).toEqual({
      verb: "Modifier",
      what: "auth.ts",
      size: "+3 −1",
    });
    expect(requestLine({ ...request, tool: "Write", target: "new.ts", detail: null, added: 12, removed: null }, fr.agents.request).size).toBe("+12");
  });
});

group("agentsLayout", () => {
  const step = (tool: string, target: string) => ({ tool, target, link: `D:/p/${target}`, failed: false, at: 0 });
  const busy = { ...session("a", "working", 5), recent: [1, 2, 3, 4, 5, 6].map((i) => step("Read", `f${i}.ts`)) };

  it("shows the steps of the session in focus, four at most", () => {
    const layout = agentsLayout([busy, session("b", "done", 1)], null, 340);
    expect(layout.focus).toBe("a");
    expect(layout.steps).toBe(4);
    expect(layout.size[1]).toBe(20 + 2 * 50 + 4 * 30 + 6);
  });

  it("follows the hovered session", () => {
    expect(agentsLayout([busy, session("b", "done", 1)], "b", 340)).toMatchObject({ focus: "b", steps: 0 });
  });

  it("fits under the window: steps give way first", () => {
    const many = [busy, ...["b", "c", "d", "e"].map((id) => session(id, "done", 1))];
    const layout = agentsLayout(many, null, 340);
    expect(layout.size[1]).toBeLessThanOrEqual(340);
    expect(layout.rows).toHaveLength(5);
    expect(layout.steps).toBeLessThan(4);
  });
});

group("steps", () => {
  it("says what was done, and what opening it does", () => {
    const fetch = { tool: "WebFetch", target: "docs.rs", link: "https://docs.rs/x", failed: false, at: 0 };
    expect(stepText(fetch, fr.agents)).toBe("Consulté docs.rs");
    expect(stepKind(fetch)).toBe("page");
    expect(stepKind({ ...fetch, tool: "Edit" })).toBe("file");
    expect(stepKind({ ...fetch, tool: "WebSearch" })).toBe("search");
  });

  it("sizes a question card for its longest list", () => {
    const q = (n: number) => ({ question: "?", multiSelect: false, options: Array.from({ length: n }, (_, i) => ({ label: `o${i}` })) });
    expect(questionCardSize([q(2), q(4)])[1]).toBe(134 + 4 * 42);
  });
});

group("usage", () => {
  it("names a limit by its length", () => {
    expect(fr.agents.window(300)).toBe("5 h");
    expect(fr.agents.window(10080)).toBe("7 j");
    expect(fr.agents.window(43200)).toBe("30 j");
  });

  it("finds the fullest limit, and warns as it fills", () => {
    const usage = { agent: "claude", updated: 0, windows: [{ minutes: 300, used: 23, resetsAt: null }, { minutes: 10080, used: 81, resetsAt: null }] };
    expect(fullest(usage)?.minutes).toBe(10080);
    expect(fullest(undefined)).toBeNull();
    expect([usageTone(40), usageTone(80), usageTone(95)]).toEqual(["ok", "high", "full"]);
  });

  it("makes room for the usage row and a change's lines", () => {
    expect(agentsLayout([session("a", "working")], null, 340, true).size[1]).toBe(20 + 34 + 50);
    const diff = Array.from({ length: 20 }, () => ({ kind: "+" as const, text: "x" }));
    expect(diffCardSize(diff)[1]).toBe(122 + 24 + 9 * 17);
  });
});

group("details", () => {
  it("counts the context line with the steps", () => {
    const withContext = { ...session("a", "working", 1), context: 42, recent: [{ tool: "Read", target: "a", link: "a", failed: false, at: 0 }] };
    expect(agentsLayout([withContext], null, 340).size[1]).toBe(20 + 50 + 2 * 30 + 6);
  });

  it("says a duration in its largest unit", () => {
    expect(span(40, "j")).toBe("40 min");
    expect(span(150, "j")).toBe("3 h");
    expect(span(4 * 1440, "j")).toBe("4 j");
  });
});
