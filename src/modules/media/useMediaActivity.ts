import { useEffect, useRef, type Dispatch } from "react";
import type { MediaState } from "../../ipc/media";
import type { IslandController } from "../../machine/controller";
import type { IslandEvent } from "../../machine/island-machine";
import { mediaDecision, trackKey } from "./progress";
import { startMedia, useMedia } from "./store";

export const MEDIA_ACTIVITY = { id: "media", priority: 10 };

/**
 * After a pause, the music activity stays this long: a track change often
 * reports "paused" for an instant, and a short pause should not collapse
 * the island.
 */
export const PAUSE_GRACE_MS = 8000;

/** Turns media state changes into island events: live activity and peeks. */
export function useMediaActivity(controller: IslandController, dispatch: Dispatch<IslandEvent>): void {
  const { state } = useMedia();
  const previous = useRef<MediaState | null | undefined>(undefined);
  const grace = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => startMedia(), []);

  useEffect(() => {
    if (state === undefined) return;
    const { live, peek } = mediaDecision(previous.current, state);
    previous.current = state;

    if (live) {
      if (grace.current) clearTimeout(grace.current);
      grace.current = null;
      dispatch({ type: "activity.set", activity: MEDIA_ACTIVITY });
    } else if (!grace.current) {
      grace.current = setTimeout(() => {
        grace.current = null;
        dispatch({ type: "activity.clear", id: MEDIA_ACTIVITY.id });
      }, PAUSE_GRACE_MS);
    }
    if (peek) controller.showPeek(`media:${trackKey(state)}`);
  }, [state, controller, dispatch]);

  useEffect(
    () => () => {
      if (grace.current) clearTimeout(grace.current);
    },
    [],
  );
}
