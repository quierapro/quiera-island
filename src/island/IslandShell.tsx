import { useEffect, type ReactNode } from "react";
import { animate, motion, useMotionValue, useTransform, type MotionValue } from "motion/react";
import type { ShellTarget } from "./geometry";
import { bodyPath, FLARE, leftFlarePath, rightFlarePath, silhouetteWidth } from "./shell";
import { DURATIONS, slowed, SPRINGS, type Spring } from "./springs";

interface IslandShellProps {
  /** Where the shell is heading. Changing it mid-flight retargets the springs. */
  target: ShellTarget;
  /** Shape at mount, before springing toward `target`. */
  initial: ShellTarget;
  /** 1 = normal speed; 4 = four times slower (debug). */
  timeScale: number;
  reducedMotion: boolean;
  onPointerEnter(): void;
  onPointerLeave(): void;
  onPress(): void;
  children?: ReactNode;
}

/**
 * The island's physical surface. Every dimension is a spring-driven motion
 * value: a new target never restarts an animation, it bends the current one,
 * keeping its velocity. Content lives in a clip that follows the same values.
 */
export function IslandShell({
  target,
  initial,
  timeScale,
  reducedMotion,
  onPointerEnter,
  onPointerLeave,
  onPress,
  children,
}: IslandShellProps) {
  const width = useMotionValue(initial.width);
  const height = useMotionValue(initial.height);
  const topRadius = useMotionValue(initial.topRadius);
  const bottomRadius = useMotionValue(initial.bottomRadius);
  const flares = useMotionValue(initial.flares);
  const fill = useMotionValue(initial.fill);
  const y = useMotionValue(initial.y);

  const { width: tw, height: th, topRadius: ttr, bottomRadius: tbr, flares: tf, fill: tfill, y: ty } = target;
  useEffect(() => {
    const spring = (s: Spring) => (reducedMotion ? { duration: 0.12 } : slowed(s, timeScale));
    const tween = (seconds: number) => ({ duration: seconds * timeScale, ease: "easeOut" as const });
    // Growing uses the bouncier spring, shrinking the calm one, per axis.
    const pick = (value: MotionValue<number>, to: number, grow: Spring, shrink: Spring) =>
      spring(to >= value.get() ? grow : shrink);

    animate(width, tw, pick(width, tw, SPRINGS.widthOpen, SPRINGS.widthClose));
    animate(height, th, pick(height, th, SPRINGS.heightOpen, SPRINGS.heightClose));
    animate(topRadius, ttr, spring(SPRINGS.radius));
    animate(bottomRadius, tbr, spring(SPRINGS.radius));
    animate(y, ty, spring(SPRINGS.y));
    animate(flares, tf, tween(DURATIONS.flares));
    animate(fill, tfill, tween(DURATIONS.fill));
  }, [tw, th, ttr, tbr, tf, tfill, ty, timeScale, reducedMotion, width, height, topRadius, bottomRadius, flares, fill, y]);

  const total = useTransform(width, silhouetteWidth);
  const body = useTransform([width, height, topRadius, bottomRadius], ([w, h, t, b]: number[]) =>
    bodyPath({ width: w, height: h, topRadius: t, bottomRadius: b }),
  );
  const rightFlare = useTransform(width, rightFlarePath);

  return (
    <motion.div
      className="island"
      style={{ width: total, height, y }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onClick={onPress}
    >
      <svg className="island-svg" aria-hidden="true">
        <motion.g style={{ opacity: fill }}>
          <motion.path d={body} />
          <motion.path d={leftFlarePath()} style={{ opacity: flares }} />
          <motion.path d={rightFlare} style={{ opacity: flares }} />
        </motion.g>
      </svg>
      <motion.div
        className="island-clip"
        style={{
          left: FLARE,
          width,
          height,
          borderTopLeftRadius: topRadius,
          borderTopRightRadius: topRadius,
          borderBottomLeftRadius: bottomRadius,
          borderBottomRightRadius: bottomRadius,
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
