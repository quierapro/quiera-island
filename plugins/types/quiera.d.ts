/**
 * Types of the Quiera plugin API (protocol 1), for editors' completion.
 * Add `/// <reference path="quiera.d.ts" />` at the top of your main.js,
 * or include this file in your tsconfig. See docs/plugins.md.
 */

declare namespace Quiera {
  /** Apple's system colours, as Quiera uses them. Nothing else is accepted. */
  type Color = "primary" | "secondary" | "tertiary" | "orange" | "green" | "red" | "blue" | "yellow" | "purple" | "pink" | "teal";

  interface Stack {
    type: "row" | "column" | "stack";
    /** Only for "stack". */
    direction?: "row" | "column";
    /** 0 to 24 px; 8 by default. */
    gap?: number;
    align?: "start" | "center" | "end" | "stretch";
    justify?: "start" | "center" | "end" | "between";
    /** Takes the room left. */
    grow?: boolean;
    children: Node[];
  }

  interface Text {
    type: "text";
    text: string;
    /** large: a big number; title; body (default); caption: small and grey. */
    style?: "large" | "title" | "body" | "caption";
    color?: Color;
    /** Lines before it is cut, 1 to 4 (2 by default). */
    lines?: number;
  }

  interface Icon {
    type: "icon";
    /** An emoji. */
    icon: string;
    /** 12 to 48 px; 20 by default. */
    size?: number;
  }

  interface Button {
    type: "button";
    label?: string;
    /** An emoji, before the label (alone in a round button). */
    icon?: string;
    /** What `quiera.on(action, …)` receives. */
    action: string;
    /** round: a 46 px circle, like the timer's; pill (default); plain: text only. */
    style?: "round" | "pill" | "plain";
    color?: Color;
  }

  interface Toggle {
    type: "toggle";
    label?: string;
    value: boolean;
    /** Its handler receives the new value. */
    action: string;
  }

  interface Progress {
    type: "progress";
    /** 0 to 1. */
    value: number;
    color?: Color;
    /** A ring instead of a bar. */
    ring?: boolean;
    /** The ring's size, 14 to 64 px. */
    size?: number;
  }

  interface ListItem {
    title: string;
    subtitle?: string;
    icon?: string;
    /** A short text at the right: a time, a price. */
    trailing?: string;
    /** Makes the row clickable. */
    action?: string;
  }

  interface List {
    type: "list";
    /** 50 at most; it scrolls. */
    items: ListItem[];
  }

  interface Spacer {
    type: "spacer";
  }

  type Node = Stack | Text | Icon | Button | Toggle | Progress | List | Spacer;

  /** The closed island: an emoji or a ring, and a short text (40 characters). */
  interface Activity {
    icon?: string;
    text?: string;
    color?: Color;
    /** 0 to 1: a ring instead of the icon. */
    progress?: number;
  }

  interface Peek {
    icon?: string;
    title: string;
    text?: string;
  }

  interface Response {
    status: number;
    ok: boolean;
    text(): Promise<string>;
    json(): Promise<any>;
  }

  interface FetchOptions {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    headers?: Record<string, string>;
    body?: string;
  }

  interface Api {
    /** Quiera's language. */
    readonly language: "fr" | "en";
    /** Shows `tree` in the plugin's tab; null empties it. 64 KB at most. */
    render(tree: Node | null): void;
    readonly activity: {
      /** Shows it on the closed island (below the music and the timer). */
      set(activity: Activity): void;
      clear(): void;
    };
    /** A moment on the island. At most one every 10 seconds. */
    peek(peek: Peek): void;
    /** Called when a button, toggle or list row with this action is used. */
    on(action: string, handler: (value: unknown) => void | Promise<void>): void;
    /** The plugin's tab was opened: a good moment to refresh. */
    onOpen(handler: () => void | Promise<void>): void;
    onClose(handler: () => void | Promise<void>): void;
    /** A memory of its own, kept between sessions (256 KB in all). */
    readonly storage: {
      get<T = unknown>(key: string): T | undefined;
      set(key: string, value: unknown): void;
      remove(key: string): void;
    };
    /** HTTPS to the hosts of the manifest's `permissions.network` only; 1 MB, 10 s, no redirect. */
    fetch(url: string, options?: FetchOptions): Promise<Response>;
  }
}

declare const quiera: Quiera.Api;
