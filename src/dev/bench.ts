/**
 * Development-only frame-pacing benchmark, run inside the real WebView2
 * window when Quiera is started with QUIERA_BENCH=1. Plays each transition
 * and writes frame statistics to the log (via the `dev_log` command).
 */
import { invoke } from "@tauri-apps/api/core";
import type { Dispatch } from "react";
import type { IslandController } from "../machine/controller";
import type { IslandEvent } from "../machine/island-machine";

export interface FrameStats {
  frames: number;
  meanMs: number;
  maxMs: number;
  over20ms: number;
}

export function frameStats(timestamps: number[]): FrameStats {
  const gaps = timestamps.slice(1).map((t, i) => t - timestamps[i]);
  if (gaps.length === 0) return { frames: timestamps.length, meanMs: 0, maxMs: 0, over20ms: 0 };
  return {
    frames: timestamps.length,
    meanMs: round(gaps.reduce((a, b) => a + b, 0) / gaps.length),
    maxMs: round(Math.max(...gaps)),
    over20ms: gaps.filter((g) => g > 20).length,
  };
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Runs `action`, then records animation frames for `ms`. */
function measure(action: () => void, ms: number): Promise<FrameStats> {
  return new Promise((resolve) => {
    const stamps: number[] = [];
    const start = performance.now();
    action();
    const tick = (now: number) => {
      stamps.push(now);
      if (now - start < ms) requestAnimationFrame(tick);
      else resolve(frameStats(stamps));
    };
    requestAnimationFrame(tick);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function benchRequested(): Promise<boolean> {
  try {
    return await invoke<boolean>("dev_bench_requested");
  } catch {
    return false;
  }
}

export async function runBench(controller: IslandController, dispatch: Dispatch<IslandEvent>): Promise<void> {
  const log = (message: string) => invoke("dev_log", { message }).catch(() => {});
  await sleep(1500);
  // The first round includes one-off costs (first mount, shader setup);
  // the second shows what the user sees from then on.
  for (const round of ["cold", "warm"]) {
    const results: Record<string, FrameStats> = {};
    results.idle = await measure(() => {}, 700);
    results.activity = await measure(
      () => dispatch({ type: "activity.set", activity: { id: "media", priority: 10 } }),
      700,
    );
    results.peek = await measure(() => controller.showPeek(`bench-${round}`), 700);
    await sleep(2500);
    results.open = await measure(() => dispatch({ type: "press" }), 700);
    results.close = await measure(() => dispatch({ type: "close" }), 700);
    results.hide = await measure(() => dispatch({ type: "visibility", visible: false }), 700);
    results.show = await measure(() => dispatch({ type: "visibility", visible: true }), 700);
    dispatch({ type: "activity.clear", id: "media" });
    await sleep(800);
    await log(`bench ${round} dpr=${window.devicePixelRatio} ${JSON.stringify(results)}`);
  }
}
