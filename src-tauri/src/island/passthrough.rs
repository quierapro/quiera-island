//! Clicks through the closed island. Closed, the island sits on the tab
//! strip of maximized windows (browsers, the Explorer); it lets clicks go
//! to them, and takes the pointer only when it rests on it:
//!
//! - a click under the island (closing a tab…) goes to the window there, and
//!   the island then stays out of the way until the pointer leaves it;
//! - the pointer on it is shown at once (`NEAR_EVENT`: the island grows a
//!   little, as when hovered), clicks still going through;
//! - the pointer slowing on it (`REST`, barely moving) opens it: the island
//!   takes the pointer, and the interface hears `REST_EVENT`;
//! - files dragged onto it from elsewhere: it takes them at once (the shelf).
//!
//! The interface asks for this while the island is closed (and the setting
//! is on); open, the island takes the pointer as any window.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter};

use super::geometry::PhysRect;
use crate::platform;

pub const REST_EVENT: &str = "island://rest";
/// The pointer came onto the island (`true`) or left it, clicks going through.
pub const NEAR_EVENT: &str = "island://near";
/// How long the pointer slows on the island before it opens: two reads,
/// felt as instant. Only a pointer crossing it fast does not open it.
const REST: Duration = Duration::from_millis(30);
/// A move smaller than this, between two reads, is slowing down (a hand is
/// never perfectly still).
const STILL_PX: i32 = 10;
const EVERY: Duration = Duration::from_millis(16);

/// What a reading of the pointer leads to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Step {
    Nothing,
    /// The pointer came onto the island, or left it (or a click sent it away).
    Near(bool),
    /// The island takes the pointer: it rested on it (`rest`), or brings files.
    Take {
        rest: bool,
    },
}

/// The rule, apart from Windows: fed the pointer at every read.
#[derive(Debug, Default)]
pub struct Gate {
    /// Off after a click under the island, until the pointer leaves it.
    disarmed: bool,
    /// Where the pointer was at the last read inside, and since when still.
    last: Option<(i32, i32)>,
    still_since: Option<Instant>,
    /// The button was down at the last read.
    was_down: bool,
    /// The island has taken the pointer: nothing more to decide.
    taken: bool,
    /// The interface was told the pointer is on the island.
    near: bool,
}

impl Gate {
    /// Starts again, as the island closes: if the pointer is on it then, it
    /// must leave before a rest counts.
    pub fn reset(&mut self, inside: bool) {
        *self = Gate {
            disarmed: inside,
            ..Gate::default()
        };
    }

    pub fn step(&mut self, inside: bool, at: (i32, i32), down: bool, now: Instant) -> Step {
        if self.taken {
            return Step::Nothing;
        }
        let entering = self.last.is_none();
        let pressed = down && !self.was_down;
        self.was_down = down;
        if !inside {
            self.disarmed = false;
            self.last = None;
            self.still_since = None;
            return self.set_near(false);
        }
        // Arriving with the button held: a drag from elsewhere (files for
        // the shelf). Taken at once, so the drop lands on the island.
        if entering && down {
            self.taken = true;
            return Step::Take { rest: false };
        }
        self.last.get_or_insert(at);
        if pressed {
            // A click under the island: it was for the window there.
            self.disarmed = true;
            self.still_since = None;
            return self.set_near(false);
        }
        let moved = self
            .last
            .is_some_and(|(x, y)| (x - at.0).abs() > STILL_PX || (y - at.1).abs() > STILL_PX);
        self.last = Some(at);
        if moved || self.still_since.is_none() {
            self.still_since = Some(now);
        }
        if !self.disarmed && !down && self.still_since.is_some_and(|t| now - t >= REST) {
            self.taken = true;
            return Step::Take { rest: true };
        }
        if self.disarmed {
            Step::Nothing
        } else {
            self.set_near(true)
        }
    }

    fn set_near(&mut self, near: bool) -> Step {
        if self.near == near {
            return Step::Nothing;
        }
        self.near = near;
        Step::Near(near)
    }
}

/// Where the island is on the screen: its window's corner, and its shape
/// in the window (physical pixels).
#[derive(Default)]
struct Shape {
    origin: (i32, i32),
    rects: Vec<PhysRect>,
}

impl Shape {
    fn contains(&self, (x, y): (i32, i32)) -> bool {
        let (x, y) = (x - self.origin.0, y - self.origin.1);
        self.rects
            .iter()
            .any(|r| x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height)
    }
}

static SHAPE: LazyLock<Mutex<Shape>> = LazyLock::new(Mutex::default);
static GATE: LazyLock<Mutex<Gate>> = LazyLock::new(Mutex::default);
/// The interface wants clicks to go through (the island is closed).
static WANTED: AtomicBool = AtomicBool::new(false);

pub fn remember_origin(x: i32, y: i32) {
    SHAPE.lock().unwrap_or_else(|e| e.into_inner()).origin = (x, y);
}

pub fn remember_shape(rects: &[PhysRect]) {
    SHAPE.lock().unwrap_or_else(|e| e.into_inner()).rects = rects.to_vec();
}

fn pointer_inside() -> Option<((i32, i32), bool, bool)> {
    let (x, y, down) = platform::pointer()?;
    let inside = SHAPE
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .contains((x, y));
    Some(((x, y), down, inside))
}

/// Reads the pointer while clicks go through, and lets the island take it.
pub fn start(app: &AppHandle) {
    let app = app.clone();
    let spawned = std::thread::Builder::new()
        .name("quiera-pointer".into())
        .spawn(move || {
            loop {
                std::thread::sleep(EVERY);
                if !WANTED.load(Ordering::Relaxed) {
                    continue;
                }
                let Some((at, down, inside)) = pointer_inside() else {
                    continue;
                };
                let step = GATE.lock().unwrap_or_else(|e| e.into_inner()).step(
                    inside,
                    at,
                    down,
                    Instant::now(),
                );
                match step {
                    Step::Take { rest } => {
                        platform::set_island_click_through(false);
                        if rest {
                            let _ = app.emit(REST_EVENT, ());
                        }
                    }
                    Step::Near(near) => {
                        let _ = app.emit(NEAR_EVENT, near);
                    }
                    Step::Nothing => {}
                }
            }
        });
    if let Err(e) = spawned {
        log::error!("could not start the pointer watch: {e}");
    }
}

/// The interface: clicks go through the island (closed), or not (open).
#[tauri::command]
pub fn island_pass_through(on: bool) {
    WANTED.store(on, Ordering::Relaxed);
    if on {
        let inside = pointer_inside().is_some_and(|(_, _, inside)| inside);
        GATE.lock().unwrap_or_else(|e| e.into_inner()).reset(inside);
    }
    platform::set_island_click_through(on);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ms(n: u64) -> Duration {
        Duration::from_millis(n)
    }

    #[test]
    fn opens_as_soon_as_the_pointer_slows_on_it() {
        let t = Instant::now();
        let mut gate = Gate::default();
        assert_eq!(gate.step(true, (10, 10), false, t), Step::Near(true));
        assert_eq!(gate.step(true, (14, 10), false, t + ms(16)), Step::Nothing);
        assert_eq!(
            gate.step(true, (16, 11), false, t + ms(32)),
            Step::Take { rest: true }
        );
        // Once taken, nothing more.
        assert_eq!(gate.step(true, (16, 11), false, t + ms(48)), Step::Nothing);
    }

    #[test]
    fn passing_over_does_not_open() {
        let t = Instant::now();
        let mut gate = Gate::default();
        for i in 0..20 {
            let step = gate.step(true, (10 + i * 20, 10), false, t + ms(16 * i as u64));
            assert_ne!(step, Step::Take { rest: true });
        }
        assert_eq!(
            gate.step(false, (300, 10), false, t + ms(600)),
            Step::Near(false)
        );
    }

    #[test]
    fn a_click_under_it_keeps_it_away_until_the_pointer_leaves() {
        let t = Instant::now();
        let mut gate = Gate::default();
        gate.step(true, (10, 10), false, t);
        // The user clicks a tab under the island…
        assert_eq!(
            gate.step(true, (10, 10), true, t + ms(100)),
            Step::Near(false)
        );
        assert_eq!(gate.step(true, (10, 10), false, t + ms(150)), Step::Nothing);
        // …and stays there: it does not open.
        assert_eq!(
            gate.step(true, (10, 10), false, t + ms(2000)),
            Step::Nothing
        );
        // It leaves and comes back to rest: now it opens.
        gate.step(false, (500, 10), false, t + ms(2100));
        gate.step(true, (20, 10), false, t + ms(2200));
        assert_eq!(
            gate.step(true, (20, 10), false, t + ms(2240)),
            Step::Take { rest: true }
        );
    }

    #[test]
    fn files_dragged_onto_it_are_taken_at_once() {
        let t = Instant::now();
        let mut gate = Gate::default();
        gate.step(false, (500, 300), true, t);
        assert_eq!(
            gate.step(true, (20, 10), true, t + ms(25)),
            Step::Take { rest: false }
        );
    }

    #[test]
    fn closing_under_the_pointer_waits_for_it_to_leave() {
        let t = Instant::now();
        let mut gate = Gate::default();
        gate.reset(true);
        assert_eq!(gate.step(true, (10, 10), false, t), Step::Nothing);
        assert_eq!(
            gate.step(true, (10, 10), false, t + ms(1000)),
            Step::Nothing
        );
        gate.step(false, (500, 10), false, t + ms(1100));
        gate.step(true, (10, 10), false, t + ms(1200));
        assert_eq!(
            gate.step(true, (10, 10), false, t + ms(1600)),
            Step::Take { rest: true }
        );
    }

    #[test]
    fn knows_where_the_island_is() {
        let shape = Shape {
            origin: (620, 0),
            rects: vec![PhysRect {
                x: 225,
                y: 0,
                width: 230,
                height: 36,
            }],
        };
        assert!(shape.contains((620 + 300, 10)));
        assert!(!shape.contains((620 + 100, 10)));
        assert!(!shape.contains((620 + 300, 40)));
    }
}
