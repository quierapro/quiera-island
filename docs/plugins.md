# Making a Quiera plugin

A plugin adds to the island: a tab of its own, something live on the closed
island (the "pill"), and short peeks. It is a folder with two files, and it
reloads by itself every time you save.

> **Status:** plugins are in developer mode. JavaScript plugins run today;
> native and WebAssembly plugins (Rust, C, Go…), free HTML views, launcher
> commands and the signed catalog come next.

## Five minutes to a first plugin

1. In Quiera: **Settings › Plugins › Open the folder**.
2. Make a folder `hello` in it, with `quiera-plugin.json`:

   ```json
   {
     "api": 1,
     "id": "hello",
     "name": "Hello",
     "version": "1.0.0",
     "icon": "👋",
     "tab": { "when": "always", "size": [360, 110] }
   }
   ```

   and `main.js`:

   ```js
   let count = 0;
   function show() {
     quiera.render({
       type: "row", justify: "between", grow: true,
       children: [
         { type: "text", text: `${count}`, style: "large" },
         { type: "button", icon: "➕", style: "round", color: "blue", action: "more" },
       ],
     });
   }
   quiera.on("more", () => { count++; show(); });
   show();
   ```

3. Back in **Settings › Plugins**, turn on **Hello**. Its 👋 tab is in the
   island; save `main.js` and it restarts with your change. **Console**
   under it shows your `console.log` and your errors.

A complete example is in [`plugins/examples/weather`](../plugins/examples/weather):
copy the folder to try it.

## The manifest: `quiera-plugin.json`

| Field | | |
|---|---|---|
| `api` | `1` | The plugin protocol it was written for. |
| `runtime` | `"js"` | What runs it. Only `"js"` today (`"wasm"` and `"native"` later). |
| `id` | required | 2 to 40 lowercase letters, digits or dashes. Unique. |
| `name` | required | Up to 40 characters. |
| `version` | required | Yours: `"1.0.0"`. |
| `author`, `description` | | Shown in the settings. |
| `icon` | `"🧩"` | One emoji: the tab's icon. |
| `main` | `"main.js"` | The entry file, in the folder. |
| `permissions.network` | `[]` | The hosts it may reach, like `"api.open-meteo.com"` (subdomains included). |
| `tab.when` | `"content"` | `"always"`: in the bar even empty; `"content"`: once it rendered. |
| `tab.size` | `[360, 140]` | Its panel, width 300–650 × height 80–260. |

Without `tab`, the plugin has no tab: it can still show an activity and peeks.
An unknown field, or a value out of range, refuses the plugin with a message
in the settings: people agree to exactly what it declares.

## The API

Everything is on the `quiera` object. For completion in your editor, add
[`plugins/types/quiera.d.ts`](../plugins/types/quiera.d.ts) next to your file
and start it with `/// <reference path="quiera.d.ts" />`.

| | |
|---|---|
| `quiera.render(tree)` | Shows `tree` in the tab (`null` empties it). |
| `quiera.activity.set({ icon, text, color, progress })` / `.clear()` | The closed island: an emoji (or a ring for `progress` 0–1) and a short text. Below the music and the timer. |
| `quiera.peek({ icon, title, text })` | A moment on the island. At most one every 10 seconds. |
| `quiera.on(action, handler)` | A button, toggle or list row with this `action` was used (a toggle passes its new value). |
| `quiera.onOpen(handler)`, `quiera.onClose(handler)` | The tab opened or closed: refresh on open. |
| `quiera.storage.get(key)`, `.set(key, value)`, `.remove(key)` | Its own memory, kept between sessions (256 KB). |
| `quiera.fetch(url, { method, headers, body })` | HTTPS to its declared hosts: `{ status, ok, text(), json() }`. |
| `quiera.language` | `"fr"` or `"en"`, Quiera's. |
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | As usual (intervals: one second at least). |
| `console.log`, `.info`, `.warn`, `.error` | To its console in the settings. |

Promises and `async`/`await` work. There is no `window`, `document`, `require`,
file system or process: a plugin only has what is above.

## The pieces of a tab

A tab is a tree of Quiera's pieces, drawn by Quiera in its own style. Colours
are Apple's system colours: `primary`, `secondary`, `tertiary`, `orange`,
`green`, `red`, `blue`, `yellow`, `purple`, `pink`, `teal`.

| Piece | Fields |
|---|---|
| `row`, `column` | `children`, `gap` (0–24), `align` (`start` `center` `end` `stretch`), `justify` (`start` `center` `end` `between`), `grow` |
| `text` | `text`, `style` (`large` `title` `body` `caption`), `color`, `lines` (1–4) |
| `icon` | `icon` (an emoji), `size` (12–48) |
| `button` | `action`, `label`, `icon`, `style` (`round` `pill` `plain`), `color` |
| `toggle` | `action`, `label`, `value` |
| `progress` | `value` (0–1), `color`, `ring`, `size` |
| `list` | `items`: `{ title, subtitle, icon, trailing, action }` (50 at most; scrolls) |
| `spacer` | takes the room left in a row or column |

Anything else is left out, never shown as is.

## Limits

So that no plugin can slow Quiera down or harm the computer:

- **Isolated:** its own JavaScript engine, without access to files, programs,
  the clipboard, notifications or other plugins.
- **Network:** HTTPS to its declared hosts only, no redirect, 10 seconds and
  1 MB per answer, 4 requests at once.
- **Memory:** 32 MB. **Time:** 1 second to start, 200 ms per event or timer;
  past it the code is interrupted, and three times in a row stops the plugin.
- **Views:** 64 KB per tab or activity; one peek every 10 seconds.
- **Consent:** people see its network hosts when they turn it on; an update
  asking for more waits for their consent again.

A stopped plugin shows why in the settings, and starts again once you edit
its files.

## The protocol

Under the API, a plugin and Quiera exchange JSON messages, the same for every
runtime (`src-tauri/src/plugins/protocol.rs`), so native and WebAssembly
plugins will speak it too:

- to Quiera: `{ "type": "render", "tree" }`, `{ "type": "activity", "activity" }`,
  `{ "type": "peek", "peek" }`, `{ "type": "log", "level", "text" }`;
- to the plugin: `{ "type": "open" }`, `{ "type": "close" }`,
  `{ "type": "action", "action", "value" }`.
