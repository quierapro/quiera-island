/**
 * The interface's errors, sent to Quiera's log: a crash shows there instead
 * of a frozen island nobody can explain.
 */
import { invoke } from "@tauri-apps/api/core";

export function reportError(error: unknown, where: string): void {
  const text = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ""}` : String(error);
  invoke("frontend_error", { message: `${where}: ${text}` }).catch(() => {});
}

/** Script errors and rejected promises nobody caught. */
export function reportUncaught(where: string): void {
  window.addEventListener("error", (e) => reportError(e.error ?? e.message, where));
  window.addEventListener("unhandledrejection", (e) => reportError(e.reason, where));
}
