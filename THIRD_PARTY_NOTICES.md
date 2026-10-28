# Third-party notices

Quiera is licensed under GPL-3.0-or-later.

This file lists code and assets taken from other projects. Every entry names
the source, its license, the files it went into and what was changed.

Dependencies installed through Cargo and pnpm keep their own license files
and are not repeated here.

## Bloom

- Source: https://github.com/SehajveerSingh2005/bloom, commit `fa32e83`
- Copyright © 2026 Sehajveer Singh
- License: GPL-3.0-only

Files copied from Bloom stay under GPL-3.0-only and keep their copyright
notice, so the combined program is distributed under GPL-3.0.

| Quiera file | Taken from | Changes |
|---|---|---|
| `src/modules/media/Marquee.tsx` | `TitleMarquee` in `src/CompactMediaPlayer.tsx` | Generic text and class names |
| `src/modules/media/views.tsx` | `CompactMediaPlayer` (`src/CompactMediaPlayer.tsx`), media controls and skip animation (`src/App.tsx`) | Quiera's media store and module sizes; own glyphs instead of SF Symbols; commands sent at once; progress drawn per frame with a transform; volume and output buttons left out; accent colour from the cover |
| `src/modules/media/media.css` (marquee section) | `.cmp-marquee*` rules and `cmp-marquee-scroll` keyframes in `src/App.css` | Renamed classes |

Ideas reused without copying code (independent implementations): the window
region clipped to the pill and held while it shrinks (`windowRegion.ts`,
`window_region.rs`), the edge flares and spring values of the pill, the birth
animation.

Not reused: Bloom's icons in `src/icons/sf/` are Apple SF Symbols, licensed
for Apple platforms only.
