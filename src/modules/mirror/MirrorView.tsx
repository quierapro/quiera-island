import { useEffect, useRef, useState } from "react";
import type { Size } from "../../island/geometry";
import { useT } from "../../i18n";
import "./mirror.css";

/** The open panel: a 16:9 picture with a little room around it. */
export const MIRROR_SIZE: Size = [372, 222, 28];

export function MirrorIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Zm12 2.5 4-2.5v8l-4-2.5" />
    </svg>
  );
}

type State = "starting" | "on" | "denied" | "none";

/**
 * The mirror: the webcam, as a mirror, to check yourself before a call. The
 * camera is on only while this tab shows, and off as soon as it is left.
 */
export function MirrorView() {
  const t = useT().mirror;
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<State>("starting");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let live = true;
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false })
      .then((s) => {
        if (!live) {
          s.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = s;
        if (video.current) video.current.srcObject = s;
        setState("on");
      })
      .catch((e: DOMException) => {
        if (live) setState(e.name === "NotFoundError" || e.name === "OverconstrainedError" ? "none" : "denied");
      });
    return () => {
      live = false;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="mirror">
      <div className={`mirror-frame ${state === "on" ? "mirror-frame--on" : ""}`}>
        <video ref={video} className="mirror-video" autoPlay muted playsInline />
        {state !== "on" && (
          <div className="mirror-message">
            <MirrorIcon size={22} />
            {state === "starting" ? null : <span>{state === "none" ? t.noCamera : t.denied}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
