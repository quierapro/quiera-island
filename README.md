# Quiera

An island at the top of your screen for media, quick controls and live activities. Built for Windows 11 first.

> **Status: early development.** The pill shows the time at rest and what is playing (Spotify, browsers and other apps that publish to Windows media controls) with synced lyrics and a player adapted from Bloom. Files dropped on it are kept on a Shelf and can be dragged out again. Short peeks announce the charger, a new audio output (with headphone battery when Windows knows it), Caps Lock and volume. A Clipboard tab keeps what you copied during the session (never written to disk; copies password managers mark private are skipped). Notifications show up on the island (quietly in Do not disturb), with links that open and a click that opens the app (Windows does not let other apps reply to or press a notification's buttons). A Controls tab toggles Wi-Fi and Bluetooth, switches the audio output and sets the master and per-app volumes. A launcher (Alt+Space) finds apps, files of every drive (by name or kind: "images", "videos"), computes and searches the web. Everything is set in a settings window (start with Windows, screen, hover, shortcut, lyrics, each module and peek), applied at once. It steps aside for fullscreen apps, follows display changes and recovers from web view crashes.

## Development

Requirements: Windows 11, [Rust](https://rustup.rs) stable, Node.js 20+, pnpm 10.

```sh
pnpm install
pnpm tauri dev      # run the app
pnpm test           # frontend unit tests (Vitest)
pnpm build          # typecheck + frontend build
cd src-tauri
cargo test          # backend unit tests
cargo clippy --all-targets -- -D warnings
```

## Layout

| Path | Contents |
|---|---|
| `src/` | Frontend (React, TypeScript) |
| `src-tauri/src/` | Backend (Rust) |
| `src-tauri/src/platform/` | Everything OS-specific, one module per platform |
| `docs/` | Design and planning documents (French) |

The design documents explain the choices behind the project:
[analysis and plan](docs/01-analyse-et-plan.md) and
[decisions, design and features](docs/02-decisions-design-fonctionnalites.md).

## License

GPL-3.0-or-later. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
