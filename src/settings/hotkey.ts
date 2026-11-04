/**
 * Recording a shortcut from the keyboard: what is held when the keys are
 * released. Modifiers (Ctrl, Alt, Shift, Win) and one key, or a modifier
 * alone; a key alone may be asked to be pressed twice. A letter alone would
 * fire in every app: it must come with a modifier.
 */
import type { Hotkey } from "../ipc/settings";

/** What a key press is, for the recorder. */
export interface KeyPress {
  /** Windows' virtual-key code (Chromium's `keyCode` on Windows). */
  keyCode: number;
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

/** The names a language gives to keys. */
export interface KeyNames {
  shift: string;
  space: string;
  none: string;
  twice: string;
}

const SHIFT = 16;
const CONTROL = 17;
const ALT = 18;
const WIN = 91;
const MODIFIERS: Record<number, number> = { 16: SHIFT, 17: CONTROL, 18: ALT, 91: WIN, 92: WIN };

export const isModifierKey = (vk: number) => vk in MODIFIERS;

/** Keys that may stand alone: they type nothing. */
const ALONE = new Set([0x13 /* Pause */, 0x91 /* Scroll Lock */, 0x2d /* Insert */]);
const isFunctionKey = (vk: number) => vk >= 0x70 && vk <= 0x87;

const NAMED: Record<number, string> = {
  0x08: "⌫",
  0x09: "Tab",
  0x0d: "Entrée",
  0x13: "Pause",
  0x21: "Page↑",
  0x22: "Page↓",
  0x23: "Fin",
  0x24: "Début",
  0x25: "←",
  0x26: "↑",
  0x27: "→",
  0x28: "↓",
  0x2d: "Inser",
  0x2e: "Suppr",
  0x91: "Arrêt défil",
};

/** The name of a key from its code: letters and digits as on the key. */
export function keyName(press: KeyPress, names: KeyNames): string {
  const vk = press.keyCode;
  if (vk === 0x20) return names.space;
  if ((vk >= 0x41 && vk <= 0x5a) || (vk >= 0x30 && vk <= 0x39)) return String.fromCharCode(vk);
  if (isFunctionKey(vk)) return `F${vk - 0x6f}`;
  if (vk >= 0x60 && vk <= 0x69) return `Num ${vk - 0x60}`;
  if (NAMED[vk]) return NAMED[vk];
  return press.key.length === 1 ? press.key.toUpperCase() : press.key;
}

type Held = Pick<KeyPress, "ctrlKey" | "altKey" | "shiftKey" | "metaKey">;

/** The modifiers held, as names. */
function modifierNames(press: Held, names: KeyNames): string[] {
  return [press.ctrlKey && "Ctrl", press.altKey && "Alt", press.shiftKey && names.shift, press.metaKey && "Win"].filter(
    (m): m is string => Boolean(m),
  );
}

/** "Ctrl+Alt+", the modifiers held. */
export function modifiersLabel(press: Held, names: KeyNames): string {
  return modifierNames(press, names)
    .map((m) => `${m}+`)
    .join("");
}

export type Recorded =
  /** Several modifiers alone: a key is still wanted. */
  | { kind: "pending"; label: string }
  /** A shortcut, if the keys are released now. */
  | { kind: "candidate"; hotkey: Hotkey }
  /** A key alone that types something. */
  | { kind: "alone" };

/** What a key going down makes of the shortcut being recorded. */
export function pressed(press: KeyPress, names: KeyNames): Recorded {
  const held = modifierNames(press, names);
  if (isModifierKey(press.keyCode)) {
    // One modifier alone is a shortcut; several are waiting for a key.
    if (held.length !== 1) return { kind: "pending", label: modifiersLabel(press, names) };
    return {
      kind: "candidate",
      // Alone, it is asked twice by default: a single Ctrl comes easily.
      hotkey: { ctrl: false, alt: false, shift: false, win: false, key: MODIFIERS[press.keyCode], label: held[0], double: true },
    };
  }
  const hasModifier = held.length > 0;
  if (!hasModifier && !isFunctionKey(press.keyCode) && !ALONE.has(press.keyCode)) return { kind: "alone" };
  return {
    kind: "candidate",
    hotkey: {
      ctrl: press.ctrlKey,
      alt: press.altKey,
      shift: press.shiftKey,
      win: press.metaKey,
      key: press.keyCode,
      label: modifiersLabel(press, names) + keyName(press, names),
      double: false,
    },
  };
}

/** Of two candidates, the one with a key beats a modifier alone. */
export function better(current: Hotkey | null, next: Hotkey): Hotkey {
  if (!current) return next;
  if (isModifierKey(current.key) || !isModifierKey(next.key)) return next;
  return current;
}

/** A key alone: it can be asked to be pressed twice. */
export function isSingleKey(hotkey: Hotkey): boolean {
  return hotkey.key !== 0 && !hotkey.ctrl && !hotkey.alt && !hotkey.shift && !hotkey.win;
}

/** The shortcut, as shown: its label in this language's words, "×2" when pressed twice. */
export function hotkeyLabel(hotkey: Hotkey, names: KeyNames): string {
  if (!hotkey.key) return names.none;
  // Recorded in another language: Shift and Space in this one's words.
  const label = hotkey.label
    .replace(/^((?:[^+]+\+)*)(Maj|Shift)(\+|$)/, `$1${names.shift}$3`)
    .replace(/(Espace|Space)$/, names.space);
  return hotkey.double ? `${label} ${names.twice}` : label;
}
