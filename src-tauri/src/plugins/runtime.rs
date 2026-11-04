//! The JavaScript runtime: one plugin in its own engine on its own thread,
//! with nothing of the system but the functions handed to it here. It
//! speaks the protocol (`protocol.rs`) like any other runtime.
//!
//! - Memory: 32 MB at most, and a small stack.
//! - Time: each call into the plugin (its start, an event, a timer) has a
//!   budget; past it the engine interrupts the code. A plugin that keeps
//!   overrunning is stopped.
//! - Network: through `net::fetch`, which allows its manifest's hosts only.
//! - Storage: a small JSON file of its own.

use std::cell::{Cell, RefCell};
use std::cmp::Reverse;
use std::collections::{BTreeMap, BinaryHeap};
use std::path::PathBuf;
use std::rc::Rc;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use rquickjs::{CatchResultExt, CaughtError, Context, Ctx, Function, Object, Persistent, Runtime};

use super::manifest::Manifest;
use super::net;
use super::protocol::{Level, ToPlugin, ToQuiera};

const MEMORY: usize = 32 << 20;
const STACK: usize = 512 << 10;
/// The plugin's own code, the first time it runs.
const START_BUDGET: Duration = Duration::from_secs(1);
/// Each event, timer or answer after that.
const CALL_BUDGET: Duration = Duration::from_millis(200);
/// Overruns in a row before the plugin is stopped.
const STRIKES: u32 = 3;
const MAX_STORAGE: usize = 256 << 10;
/// A message larger than this is refused before it is even read.
const MAX_MESSAGE: usize = 256 << 10;
const MAX_FETCHES: usize = 4;
const MAX_TIMERS: usize = 64;

const PRELUDE: &str = include_str!("prelude.js");

/// The plugin's timers, soonest first: when, and the prelude's id.
type Timers = Rc<RefCell<BinaryHeap<Reverse<(Instant, u64)>>>>;

/// What comes out of a runtime: the plugin's messages, or its end.
pub enum Out {
    Message(ToQuiera),
    /// It stopped by itself: an error at start, or too slow.
    Failed(String),
}

fn log(level: Level, text: impl Into<String>) -> Out {
    Out::Message(ToQuiera::Log {
        level,
        text: text.into(),
    })
}

enum In {
    Message(ToPlugin),
    Fetched(u64, Result<net::Response, String>),
    Stop,
}

pub struct Plugin {
    tx: Sender<In>,
    thread: Option<JoinHandle<()>>,
}

impl Plugin {
    /// Starts it; `out` receives what it shows, from its thread.
    pub fn start(
        manifest: Manifest,
        source: String,
        storage: PathBuf,
        out: Arc<dyn Fn(Out) + Send + Sync>,
    ) -> Plugin {
        let (tx, rx) = mpsc::channel();
        let back = tx.clone();
        let thread = std::thread::Builder::new()
            .name(format!("plugin-{}", manifest.id))
            .spawn(move || {
                if let Err(e) = run(&manifest, &source, storage, rx, back, &out) {
                    out(Out::Failed(e));
                }
            })
            .ok();
        Plugin { tx, thread }
    }

    pub fn send(&self, message: ToPlugin) {
        let _ = self.tx.send(In::Message(message));
    }
}

impl Drop for Plugin {
    fn drop(&mut self) {
        let _ = self.tx.send(In::Stop);
        // Not joined: a plugin stuck in a long call ends at its budget.
        drop(self.thread.take());
    }
}

/// An error thrown by the plugin, as its author needs it: message and stack.
fn describe(error: CaughtError) -> String {
    match error {
        CaughtError::Exception(ex) => {
            let message = ex.message().unwrap_or_default();
            match ex.stack() {
                Some(stack) if !stack.trim().is_empty() => {
                    format!("{message}\n{}", stack.trim_end())
                }
                _ => message,
            }
        }
        other => other.to_string(),
    }
}

fn is_interrupt(message: &str) -> bool {
    message.starts_with("interrupted")
}

struct Storage {
    path: PathBuf,
    values: BTreeMap<String, String>,
}

impl Storage {
    fn load(path: PathBuf) -> Storage {
        let values = std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        Storage { path, values }
    }

    fn set(&mut self, key: String, value: Option<String>) -> Result<(), String> {
        let mut next = self.values.clone();
        match value {
            Some(v) => next.insert(key, v),
            None => next.remove(&key),
        };
        let json = serde_json::to_string(&next).map_err(|e| e.to_string())?;
        if json.len() > MAX_STORAGE {
            return Err("storage is full (256 KB)".into());
        }
        if let Some(dir) = self.path.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        std::fs::write(&self.path, json).map_err(|e| e.to_string())?;
        self.values = next;
        Ok(())
    }
}

fn run(
    manifest: &Manifest,
    source: &str,
    storage: PathBuf,
    rx: Receiver<In>,
    back: Sender<In>,
    out: &Arc<dyn Fn(Out) + Send + Sync>,
) -> Result<(), String> {
    let runtime = Runtime::new().map_err(|e| e.to_string())?;
    runtime.set_memory_limit(MEMORY);
    runtime.set_max_stack_size(STACK);
    let deadline: Rc<Cell<Option<Instant>>> = Rc::new(Cell::new(None));
    {
        let deadline = deadline.clone();
        runtime.set_interrupt_handler(Some(Box::new(move || {
            deadline.get().is_some_and(|d| Instant::now() > d)
        })));
    }
    let context = Context::full(&runtime).map_err(|e| e.to_string())?;

    let timers: Timers = Rc::default();
    let storage = Rc::new(RefCell::new(Storage::load(storage)));
    let in_flight = Arc::new(AtomicUsize::new(0));
    let hosts = Arc::new(manifest.permissions.network.clone());

    let dispatch = context.with(|ctx| -> Result<Persistent<Function<'static>>, String> {
        let host = host_object(
            &ctx,
            out.clone(),
            timers.clone(),
            storage.clone(),
            in_flight.clone(),
            hosts.clone(),
            back.clone(),
        )
        .map_err(|e| e.to_string())?;
        let factory: Function = ctx
            .eval(PRELUDE)
            .catch(&ctx)
            .map_err(|e| format!("prelude: {}", describe(e)))?;
        let language = match crate::i18n::lang() {
            crate::i18n::Lang::Fr => "fr",
            crate::i18n::Lang::En => "en",
        };
        let dispatch: Function = factory
            .call((host, language))
            .catch(&ctx)
            .map_err(|e| format!("prelude: {}", describe(e)))?;
        Ok(Persistent::save(&ctx, dispatch))
    })?;

    // The plugin's own code.
    deadline.set(Some(Instant::now() + START_BUDGET));
    let started = context.with(|ctx| ctx.eval::<(), _>(source).catch(&ctx).map_err(describe));
    run_jobs(&runtime, out);
    deadline.set(None);
    if let Err(e) = started {
        return Err(if is_interrupt(&e) {
            "its start took longer than 1 second".into()
        } else {
            e
        });
    }

    let mut strikes = 0;
    loop {
        let wait = timers
            .borrow()
            .peek()
            .map(|Reverse((at, _))| at.saturating_duration_since(Instant::now()));
        let message = match wait {
            Some(wait) => match rx.recv_timeout(wait) {
                Ok(m) => Some(m),
                Err(RecvTimeoutError::Timeout) => None,
                Err(RecvTimeoutError::Disconnected) => return Ok(()),
            },
            None => match rx.recv() {
                Ok(m) => Some(m),
                Err(_) => return Ok(()),
            },
        };
        // The protocol's messages, and this runtime's own: timers and answers.
        let message = match message {
            Some(In::Stop) => return Ok(()),
            Some(In::Message(m)) => serde_json::to_value(m).unwrap_or_default(),
            Some(In::Fetched(id, result)) => {
                in_flight.fetch_sub(1, Ordering::Relaxed);
                match result {
                    Ok(response) => {
                        serde_json::json!({ "type": "fetch", "id": id, "response": response })
                    }
                    Err(error) => serde_json::json!({ "type": "fetch", "id": id, "error": error }),
                }
            }
            None => {
                let due = timers.borrow_mut().pop();
                match due {
                    Some(Reverse((_, id))) => serde_json::json!({ "type": "timer", "id": id }),
                    None => continue,
                }
            }
        };
        let message = message.to_string();
        deadline.set(Some(Instant::now() + CALL_BUDGET));
        let result = context.with(|ctx| {
            let dispatch = dispatch.clone().restore(&ctx).map_err(|e| e.to_string())?;
            dispatch
                .call::<_, ()>((message,))
                .catch(&ctx)
                .map_err(describe)
        });
        run_jobs(&runtime, out);
        deadline.set(None);
        match result {
            Ok(()) => strikes = 0,
            Err(e) if is_interrupt(&e) => {
                strikes += 1;
                out(log(
                    Level::Error,
                    format!("too slow: stopped after {} ms", CALL_BUDGET.as_millis()),
                ));
                if strikes >= STRIKES {
                    return Err("too slow too often: stopped".into());
                }
            }
            Err(e) => out(log(Level::Error, e)),
        }
    }
}

/// Promises' callbacks, within the current budget.
fn run_jobs(runtime: &Runtime, out: &Arc<dyn Fn(Out) + Send + Sync>) {
    while runtime.is_job_pending() {
        match runtime.execute_pending_job() {
            Ok(_) => {}
            Err(job) => {
                let message = job.0.with(|ctx| {
                    describe(CaughtError::from_error(&ctx, rquickjs::Error::Exception))
                });
                out(log(Level::Error, message));
            }
        }
    }
}

/// The native functions the prelude builds `quiera` on.
#[allow(clippy::too_many_arguments)]
fn host_object<'js>(
    ctx: &Ctx<'js>,
    out: Arc<dyn Fn(Out) + Send + Sync>,
    timers: Timers,
    storage: Rc<RefCell<Storage>>,
    in_flight: Arc<AtomicUsize>,
    hosts: Arc<Vec<String>>,
    back: Sender<In>,
) -> rquickjs::Result<Object<'js>> {
    let host = Object::new(ctx.clone())?;

    // Every protocol message goes out through here, read strictly.
    let send_out = out.clone();
    host.set(
        "send",
        Function::new(ctx.clone(), move |json: String| {
            if json.len() > MAX_MESSAGE {
                send_out(log(
                    Level::Error,
                    "a message larger than 256 KB was ignored",
                ));
                return;
            }
            match serde_json::from_str::<ToQuiera>(&json) {
                Ok(message) => send_out(Out::Message(message)),
                Err(e) => send_out(log(Level::Error, format!("not a protocol message: {e}"))),
            }
        })?,
    )?;

    let timer_heap = timers.clone();
    let timer_out = out.clone();
    host.set(
        "timer",
        Function::new(ctx.clone(), move |id: f64, ms: f64| {
            let mut heap = timer_heap.borrow_mut();
            if heap.len() >= MAX_TIMERS {
                timer_out(log(
                    Level::Error,
                    format!("more than {MAX_TIMERS} timers: ignored"),
                ));
                return;
            }
            let delay = Duration::from_millis(ms.clamp(0.0, 86_400_000.0) as u64);
            heap.push(Reverse((Instant::now() + delay, id as u64)));
        })?,
    )?;

    let read = storage.clone();
    host.set(
        "storageGet",
        Function::new(ctx.clone(), move |key: String| {
            read.borrow().values.get(&key).cloned()
        })?,
    )?;

    let write_out = out.clone();
    host.set(
        "storageSet",
        Function::new(ctx.clone(), move |key: String, value: Option<String>| {
            if let Err(e) = storage.borrow_mut().set(key, value) {
                write_out(log(Level::Error, format!("storage: {e}")));
            }
        })?,
    )?;

    let fetch_out = out;
    host.set(
        "fetch",
        Function::new(ctx.clone(), move |id: f64, json: String| {
            let id = id as u64;
            let back = back.clone();
            let request: net::Request = match serde_json::from_str(&json) {
                Ok(r) => r,
                Err(e) => {
                    let _ = back.send(In::Fetched(id, Err(e.to_string())));
                    return;
                }
            };
            if in_flight.fetch_add(1, Ordering::Relaxed) >= MAX_FETCHES {
                fetch_out(log(
                    Level::Warn,
                    format!("more than {MAX_FETCHES} requests at once: this one waits its turn"),
                ));
            }
            let hosts = hosts.clone();
            std::thread::spawn(move || {
                let _ = back.send(In::Fetched(id, net::fetch(request, &hosts)));
            });
        })?,
    )?;

    Ok(host)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    /// Runs `source` as a plugin and collects what it sends for `wait`.
    fn run_plugin(
        source: &str,
        network: &[&str],
        wait: Duration,
        then: impl FnOnce(&Plugin),
    ) -> Vec<String> {
        let hosts: Vec<String> = network.iter().map(|h| format!("\"{h}\"")).collect();
        let manifest = Manifest::parse(&format!(
            r#"{{ "id": "test", "name": "Test", "version": "1", "permissions": {{ "network": [{}] }} }}"#,
            hosts.join(",")
        ))
        .unwrap();
        let storage = std::env::temp_dir().join(format!(
            "quiera-plugin-test-{}-{:?}.json",
            std::process::id(),
            std::thread::current().id()
        ));
        let _ = std::fs::remove_file(&storage);
        let seen = Arc::new(Mutex::new(Vec::new()));
        let sink = seen.clone();
        let plugin = Plugin::start(
            manifest,
            source.to_owned(),
            storage.clone(),
            Arc::new(move |out| {
                let line = match out {
                    Out::Message(ToQuiera::Render { tree }) => {
                        format!("render {}", tree.map(|v| v.to_string()).unwrap_or_default())
                    }
                    Out::Message(ToQuiera::Activity { activity }) => format!(
                        "activity {}",
                        activity.map(|v| v.to_string()).unwrap_or_default()
                    ),
                    Out::Message(ToQuiera::Peek { peek }) => format!("peek {peek}"),
                    Out::Message(ToQuiera::Log { level, text }) => format!(
                        "{} {text}",
                        serde_json::to_value(level).unwrap().as_str().unwrap()
                    ),
                    Out::Failed(e) => format!("failed {e}"),
                };
                sink.lock().unwrap().push(line);
            }),
        );
        std::thread::sleep(Duration::from_millis(150));
        then(&plugin);
        std::thread::sleep(wait);
        drop(plugin);
        let _ = std::fs::remove_file(&storage);
        seen.lock().unwrap().clone()
    }

    #[test]
    fn renders_logs_and_answers_actions() {
        let lines = run_plugin(
            r#"
            console.log("hello", { a: 1 });
            quiera.render({ type: "text", text: "0" });
            let n = 0;
            quiera.on("more", () => quiera.render({ type: "text", text: String(++n) }));
            "#,
            &[],
            Duration::from_millis(150),
            |p| {
                p.send(ToPlugin::Action {
                    action: "more".into(),
                    value: None,
                })
            },
        );
        assert_eq!(lines[0], r#"log hello {"a":1}"#);
        assert_eq!(lines[1], r#"render {"text":"0","type":"text"}"#);
        assert_eq!(lines[2], r#"render {"text":"1","type":"text"}"#);
    }

    #[test]
    fn runs_timers_and_keeps_its_storage() {
        let lines = run_plugin(
            r#"
            quiera.storage.set("count", { n: 41 });
            setTimeout(() => console.log("later", quiera.storage.get("count").n + 1), 50);
            const t = setTimeout(() => console.log("never"), 60);
            clearTimeout(t);
            "#,
            &[],
            Duration::from_millis(250),
            |_| {},
        );
        assert_eq!(lines, ["log later 42"]);
    }

    #[test]
    fn cannot_reach_hosts_it_did_not_declare() {
        let lines = run_plugin(
            r#"quiera.fetch("https://example.com/").then(() => console.log("reached"), (e) => console.log("refused", e.message));"#,
            &["api.open-meteo.com"],
            Duration::from_millis(300),
            |_| {},
        );
        assert_eq!(
            lines,
            ["log refused example.com is not in this plugin's network permissions"]
        );
    }

    #[test]
    fn has_no_way_out_of_its_box() {
        let lines = run_plugin(
            r#"console.log(typeof require, typeof process, typeof window, typeof fetch, typeof __host, typeof host, typeof std, typeof os);"#,
            &[],
            Duration::from_millis(50),
            |_| {},
        );
        assert_eq!(
            lines,
            ["log undefined undefined undefined undefined undefined undefined undefined undefined"]
        );
    }

    #[test]
    fn knows_the_language_and_cannot_change_the_api() {
        let lines = run_plugin(
            r#"try { quiera.render = null; } catch (e) { console.log("refused", e.message); }
               console.log(typeof quiera.render, ["fr", "en"].includes(quiera.language));"#,
            &[],
            Duration::from_millis(50),
            |_| {},
        );
        assert_eq!(
            lines,
            ["log refused 'render' is read-only", "log function true"]
        );
    }

    #[test]
    fn an_endless_start_is_stopped() {
        let lines = run_plugin("for (;;) {}", &[], Duration::from_millis(1300), |_| {});
        assert_eq!(lines, ["failed its start took longer than 1 second"]);
    }

    #[test]
    fn a_slow_handler_is_interrupted_then_the_plugin_stopped() {
        let lines = run_plugin(
            r#"quiera.on("spin", () => { for (;;) {} });"#,
            &[],
            Duration::from_millis(900),
            |p| {
                for _ in 0..3 {
                    p.send(ToPlugin::Action {
                        action: "spin".into(),
                        value: None,
                    });
                }
            },
        );
        assert_eq!(
            lines
                .iter()
                .filter(|l| l.starts_with("error too slow"))
                .count(),
            3,
            "{lines:?}"
        );
        assert_eq!(lines.last().unwrap(), "failed too slow too often: stopped");
    }

    #[test]
    fn memory_is_limited() {
        let lines = run_plugin(
            r#"const a = []; for (;;) a.push(new Array(100000).fill(1));"#,
            &[],
            Duration::from_millis(1300),
            |_| {},
        );
        assert_eq!(lines.len(), 1, "{lines:?}");
        assert!(lines[0].starts_with("failed"), "{lines:?}");
    }

    #[test]
    #[ignore = "reaches the network"]
    fn fetches_from_a_declared_host() {
        let lines = run_plugin(
            r#"quiera.fetch("https://api.open-meteo.com/v1/forecast?latitude=48.85&longitude=2.35&current=temperature_2m")
                .then((r) => r.json())
                .then((j) => console.log("ok", typeof j.current.temperature_2m), (e) => console.log("failed", e.message));"#,
            &["api.open-meteo.com"],
            Duration::from_secs(8),
            |_| {},
        );
        assert_eq!(lines, ["log ok number"]);
    }

    #[test]
    #[ignore = "reaches the network"]
    fn the_weather_example_shows_the_weather() {
        let source = include_str!("../../../plugins/examples/weather/main.js");
        let lines = run_plugin(source, &["api.open-meteo.com"], Duration::from_secs(6), |p| {
            p.send(ToPlugin::Action { action: "pill".into(), value: Some(serde_json::json!(true)) })
        });
        let renders: Vec<&String> = lines.iter().filter(|l| l.starts_with("render")).collect();
        let last = renders.last().expect("it rendered");
        assert!(last.contains("°") && last.contains("Paris"), "{lines:#?}");
        assert!(lines.iter().any(|l| l.starts_with("activity {")), "{lines:#?}");
        assert!(!lines.iter().any(|l| l.starts_with("error") || l.starts_with("failed")), "{lines:#?}");
    }

    #[test]
    fn sends_peeks_and_activities_through_the_protocol() {
        let lines = run_plugin(
            r#"quiera.peek({ title: "a" }); quiera.activity.set({ text: "14°" }); quiera.activity.clear();"#,
            &[],
            Duration::from_millis(50),
            |_| {},
        );
        assert_eq!(
            lines,
            [
                r#"peek {"title":"a"}"#,
                r#"activity {"text":"14°"}"#,
                "activity "
            ]
        );
    }
}
