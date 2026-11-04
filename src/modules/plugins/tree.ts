/**
 * The pieces a plugin builds its views from, read from the JSON it sends.
 * Anything unknown or malformed is dropped, never shown as is: a plugin can
 * only compose Quiera's own pieces, with Quiera's own colours.
 */

export const COLORS = ["primary", "secondary", "tertiary", "orange", "green", "red", "blue", "yellow", "purple", "pink", "teal"] as const;
export type Color = (typeof COLORS)[number];

export type Node =
  | { type: "stack"; direction: "row" | "column"; gap: number; align: "start" | "center" | "end" | "stretch"; justify: "start" | "center" | "end" | "between"; grow: boolean; children: Node[] }
  | { type: "text"; text: string; style: "large" | "title" | "body" | "caption"; color: Color; lines: number }
  | { type: "icon"; icon: string; size: number }
  | { type: "button"; label: string; icon: string; action: string; style: "round" | "pill" | "plain"; color: Color }
  | { type: "toggle"; label: string; value: boolean; action: string }
  | { type: "progress"; value: number; color: Color; ring: boolean; size: number }
  | { type: "list"; items: ListItem[] }
  | { type: "spacer" };

export interface ListItem {
  title: string;
  subtitle: string;
  icon: string;
  trailing: string;
  action: string;
}

/** The pill: an icon or a ring, and a short text. */
export interface Activity {
  icon: string;
  text: string;
  color: Color;
  /** 0 → 1: a ring instead of the icon. */
  progress: number | null;
}

export interface Peek {
  icon: string;
  title: string;
  text: string;
}

const MAX_DEPTH = 8;
const MAX_CHILDREN = 40;
const MAX_ITEMS = 50;

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);

function str(v: unknown, max = 200): string {
  return typeof v === "string" ? v.slice(0, max) : typeof v === "number" ? String(v).slice(0, max) : "";
}

function pick<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return options.includes(v as T) ? (v as T) : fallback;
}

function num(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(v, min), max) : fallback;
}

/** An emoji or two (by code point, so none is cut in half): never a text where an icon goes. */
const icon = (v: unknown) => (typeof v === "string" ? [...v].slice(0, 4).join("") : "");

export function parseNode(raw: unknown, depth = 0): Node | null {
  if (!isObject(raw) || depth > MAX_DEPTH) return null;
  switch (raw.type) {
    case "stack":
    case "row":
    case "column":
      return {
        type: "stack",
        direction: raw.type === "row" ? "row" : raw.type === "column" ? "column" : pick(raw.direction, ["row", "column"] as const, "column"),
        gap: num(raw.gap, 0, 24, 8),
        align: pick(raw.align, ["start", "center", "end", "stretch"] as const, raw.type === "row" ? "center" : "stretch"),
        justify: pick(raw.justify, ["start", "center", "end", "between"] as const, "start"),
        grow: raw.grow === true,
        children: (Array.isArray(raw.children) ? raw.children : [])
          .slice(0, MAX_CHILDREN)
          .map((c) => parseNode(c, depth + 1))
          .filter((c): c is Node => c !== null),
      };
    case "text":
      return {
        type: "text",
        text: str(raw.text, 500),
        style: pick(raw.style, ["large", "title", "body", "caption"] as const, "body"),
        color: pick(raw.color, COLORS, raw.style === "caption" ? "secondary" : "primary"),
        lines: num(raw.lines, 1, 4, 2),
      };
    case "icon":
      return { type: "icon", icon: icon(raw.icon), size: num(raw.size, 12, 48, 20) };
    case "button": {
      const action = str(raw.action, 100);
      if (!action) return null;
      return {
        type: "button",
        label: str(raw.label, 40),
        icon: icon(raw.icon),
        action,
        style: pick(raw.style, ["round", "pill", "plain"] as const, "pill"),
        color: pick(raw.color, COLORS, "primary"),
      };
    }
    case "toggle": {
      const action = str(raw.action, 100);
      if (!action) return null;
      return { type: "toggle", label: str(raw.label, 60), value: raw.value === true, action };
    }
    case "progress":
      return { type: "progress", value: num(raw.value, 0, 1, 0), color: pick(raw.color, COLORS, "primary"), ring: raw.ring === true, size: num(raw.size, 14, 64, 28) };
    case "list":
      return {
        type: "list",
        items: (Array.isArray(raw.items) ? raw.items : []).slice(0, MAX_ITEMS).filter(isObject).map((item) => ({
          title: str(item.title, 120),
          subtitle: str(item.subtitle, 160),
          icon: icon(item.icon),
          trailing: str(item.trailing, 40),
          action: str(item.action, 100),
        })),
      };
    case "spacer":
      return { type: "spacer" };
    default:
      return null;
  }
}

export function parseActivity(raw: unknown): Activity | null {
  if (!isObject(raw)) return null;
  const text = str(raw.text, 40);
  const progress = typeof raw.progress === "number" ? num(raw.progress, 0, 1, 0) : null;
  if (!text && !raw.icon && progress === null) return null;
  return { icon: icon(raw.icon), text, color: pick(raw.color, COLORS, "primary"), progress };
}

export function parsePeek(raw: unknown): Peek | null {
  if (!isObject(raw)) return null;
  const title = str(raw.title, 60);
  if (!title) return null;
  return { icon: icon(raw.icon), title, text: str(raw.text, 120) };
}
