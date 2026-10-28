import { useEffect } from "react";
import { sendDroppedFiles } from "../../ipc/shelf";
import type { IslandController } from "../../machine/controller";

/** How long the files may go unreported before they count as gone. */
const LEAVE_MS = 150;

const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files") ?? false;

/**
 * Files dragged from another app over the island. The page takes the drop
 * itself (see `file_drop.rs` for why) and passes the files to the backend.
 * Any other drop (a link, some text) is refused, so it cannot navigate the
 * island away.
 */
export function useFileDrop(controller: IslandController): void {
  useEffect(() => {
    // dragleave also fires when moving from one element to the next, and
    // the island's content changes under the cursor as it opens: the files
    // have left only when nothing reports them back shortly after.
    let inside = false;
    let leaving: ReturnType<typeof setTimeout> | undefined;
    const still = () => {
      clearTimeout(leaving);
      if (!inside) {
        inside = true;
        controller.dragEnter();
      }
    };
    const enter = (e: DragEvent) => {
      e.preventDefault();
      if (hasFiles(e)) still();
    };
    const over = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = hasFiles(e) ? "copy" : "none";
      if (hasFiles(e)) still();
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e) || !inside) return;
      clearTimeout(leaving);
      leaving = setTimeout(() => {
        inside = false;
        controller.dragLeave();
      }, LEAVE_MS);
    };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      clearTimeout(leaving);
      inside = false;
      if (!hasFiles(e) || !e.dataTransfer) return;
      sendDroppedFiles(e.dataTransfer.files);
      controller.dragDrop();
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      clearTimeout(leaving);
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [controller]);
}
