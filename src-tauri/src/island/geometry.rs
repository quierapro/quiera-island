//! Pure geometry for the island window: where it sits on a monitor and how
//! the frontend's region rectangles map to physical pixels. No OS calls, so
//! everything here is unit-tested on every platform.

use serde::Deserialize;

/// A rectangle in physical (device) pixels.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PhysRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

/// A rectangle in the island window's CSS pixels, as the frontend sends it.
#[derive(Debug, Clone, Copy, PartialEq, Deserialize)]
pub struct LogicalRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// The island window's rectangle on a monitor: `logical_size` scaled to the
/// monitor, centered horizontally and hanging from the monitor's top edge.
pub fn island_window_rect(monitor: PhysRect, scale: f64, logical_size: (f64, f64)) -> PhysRect {
    let width = (logical_size.0 * scale).round() as i32;
    let height = (logical_size.1 * scale).round() as i32;
    PhysRect {
        x: monitor.x + (monitor.width - width) / 2,
        y: monitor.y,
        width,
        height,
    }
}

/// The region rectangles in physical window pixels: scaled, rounded outwards
/// so nothing drawn on a fractional edge is clipped, with empty or invalid
/// rectangles dropped.
pub fn region_to_physical(rects: &[LogicalRect], scale: f64) -> Vec<PhysRect> {
    rects
        .iter()
        .filter(|r| {
            [r.x, r.y, r.width, r.height].iter().all(|v| v.is_finite())
                && r.width > 0.0
                && r.height > 0.0
        })
        .map(|r| {
            let left = (r.x * scale).floor() as i32;
            let top = (r.y * scale).floor() as i32;
            let right = ((r.x + r.width) * scale).ceil() as i32;
            let bottom = ((r.y + r.height) * scale).ceil() as i32;
            PhysRect {
                x: left,
                y: top,
                width: right - left,
                height: bottom - top,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const SIZE: (f64, f64) = (680.0, 380.0);

    fn monitor(x: i32, y: i32, width: i32, height: i32) -> PhysRect {
        PhysRect {
            x,
            y,
            width,
            height,
        }
    }

    fn logical(x: f64, y: f64, width: f64, height: f64) -> LogicalRect {
        LogicalRect {
            x,
            y,
            width,
            height,
        }
    }

    #[test]
    fn centers_on_a_1080p_monitor_at_100_percent() {
        let r = island_window_rect(monitor(0, 0, 1920, 1080), 1.0, SIZE);
        assert_eq!(r, monitor(620, 0, 680, 380));
    }

    #[test]
    fn scales_the_window_with_the_monitor() {
        for (scale, width, height) in [(1.25, 850, 475), (1.5, 1020, 570), (1.75, 1190, 665)] {
            let r = island_window_rect(monitor(0, 0, 2560, 1440), scale, SIZE);
            assert_eq!((r.width, r.height), (width, height), "scale {scale}");
            assert_eq!(r.x, (2560 - width) / 2, "scale {scale}");
            assert_eq!(r.y, 0);
        }
    }

    #[test]
    fn follows_monitors_left_of_and_above_the_primary() {
        let r = island_window_rect(monitor(-1920, -300, 1920, 1080), 1.0, SIZE);
        assert_eq!(r, monitor(-1920 + 620, -300, 680, 380));
    }

    #[test]
    fn region_scales_and_rounds_outwards() {
        let r = region_to_physical(&[logical(232.0, 0.0, 216.0, 30.0)], 1.25);
        assert_eq!(r, vec![monitor(290, 0, 270, 38)]);

        let r = region_to_physical(&[logical(10.2, 0.4, 100.1, 29.5)], 1.5);
        assert_eq!(r, vec![monitor(15, 0, 151, 45)]);
    }

    #[test]
    fn region_drops_empty_and_invalid_rects() {
        let r = region_to_physical(
            &[
                logical(0.0, 0.0, 0.0, 30.0),
                logical(0.0, 0.0, 10.0, -1.0),
                logical(f64::NAN, 0.0, 10.0, 10.0),
                logical(5.0, 5.0, 10.0, 10.0),
            ],
            2.0,
        );
        assert_eq!(r, vec![monitor(10, 10, 20, 20)]);
    }
}
