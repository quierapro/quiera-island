import { useEffect, useState } from "react";
import * as shelf from "../../ipc/shelf";
import type { PhoneLink, ShelfItem } from "../../ipc/shelf";
import { countdown } from "./format";
import { ShareIcon } from "./icons";

type State = { link: PhoneLink; until: number } | { error: string } | null;

/**
 * Sending files to a phone: a QR code its camera opens (same network, link
 * valid ten minutes), or Windows' Share panel.
 */
export function PhoneShare({ items, onBack }: { items: ShelfItem[]; onBack(): void }) {
  const [state, setState] = useState<State>(null);
  const [now, setNow] = useState(() => Date.now());
  const [shareError, setShareError] = useState<string | null>(null);
  // Bumped by "Nouveau code".
  const [attempt, setAttempt] = useState(0);
  const ids = items.map((i) => i.id);
  const key = ids.join(",");

  // A link for these files, ended as soon as it leaves the screen (back, the
  // files changed, a new code): an old code must not keep serving them.
  useEffect(() => {
    let alive = true;
    let token: string | null = null;
    setState(null);
    shelf
      .shareToPhone(key.split(",").map(Number))
      .then((link) => {
        token = link.token;
        if (alive) setState({ link, until: Date.now() + link.expiresInSecs * 1000 });
        else shelf.stopPhoneShare(link.token).catch(() => {});
      })
      .catch((e) => alive && setState({ error: String(e) }));
    return () => {
      alive = false;
      if (token) shelf.stopPhoneShare(token).catch(() => {});
    };
  }, [key, attempt]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = state && "link" in state ? Math.max(0, Math.round((state.until - now) / 1000)) : 0;
  const expired = state !== null && "link" in state && left === 0;
  const what = items.length === 1 ? items[0].name : `${items.length} fichiers`;

  return (
    <div className="phone-share" onPointerDown={(e) => e.stopPropagation()}>
      <div className="phone-qr">
        {state && "link" in state && !expired ? (
          <svg viewBox={`-2 -2 ${state.link.qrSize + 4} ${state.link.qrSize + 4}`} shapeRendering="crispEdges" role="img" aria-label="QR code du lien">
            <rect x="-2" y="-2" width={state.link.qrSize + 4} height={state.link.qrSize + 4} fill="#fff" />
            <path d={state.link.qrPath} fill="#000" />
          </svg>
        ) : (
          <span className="phone-qr-empty">{expired ? "Expiré" : state && "error" in state ? "!" : ""}</span>
        )}
      </div>
      <div className="phone-text">
        <span className="phone-title">{expired ? "Ce code a expiré" : "Scanne avec ton téléphone"}</span>
        <span className="phone-name">{what}</span>
        <span className="phone-sub">
          {state === null
            ? "Préparation du lien…"
            : "error" in state
              ? state.error
              : expired
                ? "Crée un nouveau code pour l'envoyer."
                : (shareError ?? `Même Wi-Fi que le PC · expire dans ${countdown(left)}`)}
        </span>
        <div className="phone-actions">
          {expired || (state && "error" in state) ? (
            <button className="phone-btn phone-btn--main" onClick={() => setAttempt((n) => n + 1)}>
              Nouveau code
            </button>
          ) : (
            <button
              className="phone-btn"
              onClick={() => {
                setShareError(null);
                shelf.shareWithWindows(ids).catch((e) => setShareError(String(e)));
              }}
            >
              <ShareIcon size={13} />
              Partager avec Windows
            </button>
          )}
          <button className="phone-btn" onClick={onBack}>
            Retour
          </button>
        </div>
      </div>
    </div>
  );
}
