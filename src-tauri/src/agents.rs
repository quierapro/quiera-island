//! AI coding agents (Claude Code for now) on the island: what each session
//! is doing, when one waits for its user, when one has finished; allowing
//! or denying what it asks from the island; and going back to its window.
//!
//! Claude Code runs a command at each step of its work (its "hooks"). That
//! command is Quiera itself, started with `--agent-event`: it reads what
//! Claude Code sends, keeps the few fields the island shows, passes them on
//! through the agents' pipe and exits at once. With Quiera closed, it exits
//! just as fast and the agent never notices.
//!
//! A permission or a question asked is held for the island, which asks
//! instead; Terminal sends it back to the agent's own window.
//!
//! Nothing here reads a prompt or a file's content, and nothing about a
//! session (project, command, file) is ever written to the log.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tauri::{AppHandle, Emitter, Manager};

/// The argument that starts Quiera as a hook, not as the app.
pub const EVENT_ARG: &str = "--agent-event";
/// The argument that starts Quiera as Claude Code's status line: it reads
/// the usage of the subscription's limits, and shows nothing.
pub const STATUS_ARG: &str = "--agent-status";
const USAGE_EVENT: &str = "agents://usage";
/// How often Codex's own record of its limits is read.
const READ_CODEX_EVERY: Duration = Duration::from_secs(60);
/// Lines of a change shown on the island, at most.
const MAX_DIFF_LINES: usize = 40;
const SESSIONS_EVENT: &str = "agents://sessions";
/// Claude Code is running, and Quiera could listen to it.
const OFFER_EVENT: &str = "agents://offer";

/// How often stale sessions are looked for.
const SWEEP_EVERY: Duration = Duration::from_secs(60);
/// No news from a working agent for this long: it was interrupted.
const STALE_WORKING: Duration = Duration::from_secs(10 * 60);
/// A tool still running (a build, tests) may stay silent longer.
const STALE_TOOL: Duration = Duration::from_secs(60 * 60);
/// A finished session stays in the list this long.
const KEEP_DONE: Duration = Duration::from_secs(3 * 60 * 60);
const MAX_SESSIONS: usize = 20;
/// The latest steps kept per session, for the island to show and open.
const MAX_ACTIONS: usize = 6;
/// A permission held this long goes back to the terminal (Claude Code gives up at an hour).
const HOLD_AT_MOST: Duration = Duration::from_secs(30 * 60);
/// How often a held permission checks whether its user came back to the agent.
const HOLD_CHECK: Duration = Duration::from_millis(250);
/// How often Quiera looks for Claude Code being started, while it could offer to listen.
const LOOK_FOR_CLAUDE: Duration = Duration::from_secs(10);

/* ------------------------------------------------------------- Hook side */

/// What travels from a hook to the island: never the prompt, never a file.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Message {
    /// The agent: "claude".
    pub source: String,
    /// The hook's event: "PreToolUse", "Stop"…
    pub event: String,
    pub session: String,
    #[serde(default)]
    pub cwd: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool: Option<String>,
    /// What the tool works on: a file's name, a command, a question.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
    /// The notification's type ("permission_prompt"…).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    /// The window the agent runs in (a terminal, an editor).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub window: Option<i64>,
    /// For a permission: the whole command, or the address.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    /// For a permission to edit: lines added and removed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub added: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub removed: Option<u32>,
    /// What the step opens: a file's full path, an address, a search.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub link: Option<String>,
    /// For a question asked (AskUserQuestion): the questions and their options.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub questions: Option<Vec<Question>>,
    /// For a permission to change a file: the lines removed and added.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub diff: Option<Vec<DiffLine>>,
    /// From the status line: how much of each usage limit is used.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub usage: Option<Vec<UsageWindow>>,
    /// From the status line: how full the session's context window is (0-100).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context: Option<f64>,
    /// For a permission: the agent offers to stop asking for this (Claude
    /// Code's own "don't ask again" suggestions).
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub always: bool,
    /// For a permission: a command that destroys or rewrites (rm -rf, a
    /// forced push…): the island asks for a held press, never "always".
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub danger: bool,
}

/// Whether a shell command destroys or rewrites what cannot be brought
/// back: deleting folders, forced pushes, dropping tables, formatting…
pub fn dangerous(command: &str) -> bool {
    let c = command.to_lowercase();
    let words: Vec<&str> = c
        .split(|ch: char| ch.is_whitespace() || ch == ';' || ch == '&' || ch == '|')
        .filter(|w| !w.is_empty())
        .collect();
    let has = |w: &str| words.contains(&w);
    let flag = |short: char, long: &str| {
        words.iter().any(|w| {
            (w.starts_with('-') && !w.starts_with("--") && w.contains(short)) || *w == long
        })
    };
    let rm = (has("rm") && flag('r', "--recursive"))
        || ((has("rd") || has("rmdir") || has("del") || has("erase")) && words.contains(&"/s"));
    let remove_item = (has("remove-item") || has("ri"))
        && words
            .iter()
            .any(|w| w.starts_with("-r") || *w == "-recurse");
    let git = has("git")
        && ((has("push")
            && (flag('f', "--force")
                || words.iter().any(|w| {
                    w.starts_with("--force")
                        || w.starts_with('+')
                        || *w == "--delete"
                        || *w == "--mirror"
                })))
            || (has("reset") && has("--hard"))
            || (has("clean") && flag('f', "--force"))
            || (has("branch") && command.contains(" -D"))
            || (has("checkout") && has("--") && has("."))
            || (has("filter-branch") || has("filter-repo")));
    let sql = c.contains("drop table")
        || c.contains("drop database")
        || c.contains("drop schema")
        || c.contains("truncate table");
    let system = [
        "mkfs",
        "diskpart",
        "shutdown",
        "reboot",
        "stop-computer",
        "restart-computer",
    ]
    .iter()
    .any(|w| has(w))
        || (has("format") && words.iter().any(|w| w.len() == 2 && w.ends_with(':')))
        || c.contains("dd if=")
        || c.contains("> /dev/sd")
        || (has("chmod") && flag('r', "--recursive") && c.contains("777"));
    let piped_script = (c.contains("curl")
        || c.contains("wget")
        || c.contains("iwr")
        || c.contains("invoke-webrequest"))
        && (c.contains("| sh")
            || c.contains("| bash")
            || c.contains("|sh")
            || c.contains("|bash")
            || c.contains("| iex")
            || c.contains("|iex"));
    rm || remove_item
        || git
        || sql
        || system
        || piped_script
        || has("sudo")
        || c.contains("invoke-expression")
}

/// One line of a change: "-" removed, "+" added, " " unchanged around it.
/// Mirrors `AgentDiffLine` in `src/ipc/agents.ts`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DiffLine {
    pub kind: String,
    pub text: String,
}

fn line(kind: &str, text: &str) -> DiffLine {
    DiffLine {
        kind: kind.to_owned(),
        text: cut(text.trim_end(), 200).replace('\t', "    "),
    }
}

/// What a replacement changes: the lines that differ, with one unchanged
/// line around them, as an editor's diff shows it.
pub fn diff_lines(old: &str, new: &str) -> Vec<DiffLine> {
    let old: Vec<&str> = old.lines().collect();
    let new: Vec<&str> = new.lines().collect();
    let same_start = old.iter().zip(&new).take_while(|(a, b)| a == b).count();
    let max_end = old.len().min(new.len()) - same_start;
    let same_end = old
        .iter()
        .rev()
        .zip(new.iter().rev())
        .take(max_end)
        .take_while(|(a, b)| a == b)
        .count();
    let mut out = Vec::new();
    if same_start > 0 {
        out.push(line(" ", old[same_start - 1]));
    }
    out.extend(
        old[same_start..old.len() - same_end]
            .iter()
            .map(|l| line("-", l)),
    );
    out.extend(
        new[same_start..new.len() - same_end]
            .iter()
            .map(|l| line("+", l)),
    );
    if same_end > 0 {
        out.push(line(" ", old[old.len() - same_end]));
    }
    out
}

/// The whole change, cut to what the island shows.
fn bounded(mut lines: Vec<DiffLine>) -> Option<Vec<DiffLine>> {
    if lines.len() > MAX_DIFF_LINES {
        lines.truncate(MAX_DIFF_LINES - 1);
        lines.push(line(" ", "…"));
    }
    (!lines.is_empty()).then_some(lines)
}

/// One usage limit of an AI subscription: its length, how much of it is
/// used, and when it starts again. Mirrors `AgentUsageWindow` in `src/ipc/agents.ts`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageWindow {
    /// The limit's length: 300 for five hours, 10080 for a week.
    pub minutes: u32,
    /// 0 to 100 (above once exceeded).
    pub used: f64,
    /// Seconds since 1970.
    pub resets_at: Option<u64>,
    /// At the current pace, minutes until it is reached (before it resets).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub full_in: Option<u32>,
}

/// Claude Code's `rate_limits` (status line input): its five-hour and
/// weekly limits, or a gateway's spend limit.
pub fn claude_usage(status: &Value) -> Vec<UsageWindow> {
    let Some(limits) = status.get("rate_limits") else {
        return Vec::new();
    };
    let window = |key: &str, minutes: u32| {
        let w = limits.get(key)?;
        Some(UsageWindow {
            minutes,
            used: w.get("used_percentage")?.as_f64()?,
            resets_at: w.get("resets_at").and_then(Value::as_u64),
            full_in: None,
        })
    };
    let spend_minutes = match limits
        .get("spend_limit")
        .and_then(|s| s.get("period"))
        .and_then(Value::as_str)
    {
        Some("daily") => 1440,
        Some("weekly") => 10080,
        _ => 43200,
    };
    [
        window("five_hour", 300),
        window("seven_day", 10080),
        window("spend_limit", spend_minutes),
    ]
    .into_iter()
    .flatten()
    .collect()
}

/// Codex's `rate_limits` (in its session record): a primary and a secondary
/// limit, each with its own length (five hours, a week, a month…).
pub fn codex_usage(limits: &Value) -> Vec<UsageWindow> {
    ["primary", "secondary"]
        .iter()
        .filter_map(|key| {
            let w = limits.get(*key)?;
            Some(UsageWindow {
                minutes: w.get("window_minutes")?.as_u64()? as u32,
                used: w.get("used_percent")?.as_f64()?,
                resets_at: w.get("resets_at").and_then(Value::as_u64),
                full_in: None,
            })
        })
        .collect()
}

/// Run as Claude Code's status line: passes the usage of its limits to the
/// island, and prints nothing (Claude Code shows no status line by default).
pub fn run_status(source: &str) {
    let mut input = Vec::new();
    if std::io::stdin()
        .take(4 * 1024 * 1024)
        .read_to_end(&mut input)
        .is_err()
    {
        return;
    }
    let Ok(status) = serde_json::from_slice::<Value>(&input) else {
        return;
    };
    let usage = claude_usage(&status);
    let context = status
        .get("context_window")
        .and_then(|c| c.get("used_percentage"))
        .and_then(Value::as_f64);
    if usage.is_empty() && context.is_none() {
        return;
    }
    let message = Message {
        source: source.to_owned(),
        event: "Usage".into(),
        session: status
            .get("session_id")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_owned(),
        usage: Some(usage).filter(|u| !u.is_empty()),
        context,
        ..Message::default()
    };
    if let Ok(line) = serde_json::to_string(&message) {
        crate::platform::send_agent_message(&line, false);
    }
}

/// One answer Claude Code offers to a question.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionOption {
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// A question Claude Code asks its user. Mirrors `AgentQuestion` in `src/ipc/agents.ts`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Question {
    pub question: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub header: Option<String>,
    #[serde(default)]
    pub multi_select: bool,
    pub options: Vec<QuestionOption>,
}

/// The questions of an AskUserQuestion, cut for the island (the answer is
/// given by position, so the hook answers with Claude Code's own words).
fn questions_of(input: Option<&Value>) -> Option<Vec<Question>> {
    let list = input?.get("questions")?.as_array()?;
    let text = |v: &Value, key: &str, max: usize| {
        v.get(key)
            .and_then(Value::as_str)
            .map(|t| cut(t.trim(), max))
            .filter(|t| !t.is_empty())
    };
    let questions: Vec<Question> = list
        .iter()
        .take(4)
        .filter_map(|q| {
            let options = q
                .get("options")?
                .as_array()?
                .iter()
                .take(6)
                .filter_map(|o| {
                    Some(QuestionOption {
                        label: text(o, "label", 80)?,
                        description: text(o, "description", 140),
                    })
                })
                .collect::<Vec<_>>();
            Some(Question {
                question: text(q, "question", 300)?,
                header: text(q, "header", 30),
                multi_select: q
                    .get("multiSelect")
                    .and_then(Value::as_bool)
                    .unwrap_or(false),
                options,
            })
        })
        .collect();
    (!questions.is_empty() && questions.len() == list.len().min(4)).then_some(questions)
}

/// Run as a hook: reads the event on stdin, passes it on, and always
/// succeeds, so the agent is never held up nor shown an error. For a
/// permission, the island's answer, if it gives one, is printed for the agent.
pub fn run_hook(source: &str) {
    let mut input = Vec::new();
    if std::io::stdin()
        .take(64 * 1024 * 1024)
        .read_to_end(&mut input)
        .is_err()
    {
        return;
    }
    let Ok(event) = serde_json::from_slice::<Value>(&input) else {
        return;
    };
    let Some(mut message) = extract(source, &event) else {
        return;
    };
    let asks = message.event == "PermissionRequest";
    // Where to come back to: looked for when it may be needed, not at every step.
    if asks || matches!(message.event.as_str(), "SessionStart" | "UserPromptSubmit") {
        message.window = crate::platform::agent_window(&file_name(&message.cwd)).map(|w| w as i64);
    }
    let Ok(line) = serde_json::to_string(&message) else {
        return;
    };
    let reply = crate::platform::send_agent_message(&line, asks);
    if let Some(answer) = reply.and_then(|r| claude_output(&r, &event, source)) {
        let mut out = std::io::stdout();
        let _ = out.write_all(answer.as_bytes());
        let _ = out.flush();
    }
}

/// The island's answer (`{"behavior":"allow","answers":[[0]]}`), as the
/// agent reads it from a PermissionRequest hook. A question's answers go by
/// position: they are put back in the question's own words here, from the
/// tool's input, so they always match what was asked; a typed answer goes
/// as it is. "always" adds the agent's own "don't ask again" rules.
pub fn claude_output(reply: &str, event: &Value, source: &str) -> Option<String> {
    let reply: Value = serde_json::from_str(reply).ok()?;
    let tool_input = event.get("tool_input");
    let asked = tool_input.and_then(|i| i.get("questions")).is_some();
    // Codex takes a plain allow or deny: anything more fails closed.
    let plain = source != "claude";
    let decision = match reply.get("behavior")?.as_str()? {
        "allow" => {
            let mut decision = json!({ "behavior": "allow" });
            if !plain
                && reply.get("always").and_then(Value::as_bool) == Some(true)
                && let Some(rules) = event
                    .get("permission_suggestions")
                    .filter(|r| r.as_array().is_some_and(|a| !a.is_empty()))
            {
                decision["updatedPermissions"] = rules.clone();
            }
            if let Some(chosen) = reply
                .get("answers")
                .and_then(Value::as_array)
                .filter(|_| !plain)
            {
                let input = tool_input?;
                let questions = input.get("questions")?.as_array()?;
                let mut answers = serde_json::Map::new();
                for (question, picked) in questions.iter().zip(chosen) {
                    let text = question.get("question")?.as_str()?.to_owned();
                    if let Some(typed) = picked.as_str() {
                        answers.insert(text, Value::String(typed.to_owned()));
                        continue;
                    }
                    let options = question.get("options")?.as_array()?;
                    let labels = picked
                        .as_array()?
                        .iter()
                        .map(|i| options.get(i.as_u64()? as usize)?.get("label").cloned())
                        .collect::<Option<Vec<Value>>>()?;
                    let many = question
                        .get("multiSelect")
                        .and_then(Value::as_bool)
                        .unwrap_or(false);
                    let answer = if many {
                        Value::Array(labels)
                    } else {
                        labels.into_iter().next()?
                    };
                    answers.insert(text, answer);
                }
                let mut updated = input.clone();
                updated["answers"] = Value::Object(answers);
                decision["updatedInput"] = updated;
            }
            decision
        }
        "deny" => {
            let message = if asked {
                "The user chose not to answer from the Quiera island."
            } else {
                "The user denied this from the Quiera island."
            };
            json!({ "behavior": "deny", "message": message })
        }
        _ => return None,
    };
    Some(json!({ "hookSpecificOutput": { "hookEventName": "PermissionRequest", "decision": decision } }).to_string())
}

/// The text, cut to `max` characters.
fn short(text: &str, max: usize) -> String {
    let line = text
        .lines()
        .find(|l| !l.trim().is_empty())
        .unwrap_or("")
        .trim();
    cut(line, max)
}

fn cut(text: &str, max: usize) -> String {
    if text.chars().count() <= max {
        return text.to_owned();
    }
    let mut cut: String = text.chars().take(max - 1).collect();
    cut.push('…');
    cut
}

/// A path's last part: "src/auth.ts" → "auth.ts".
fn file_name(path: &str) -> String {
    path.rsplit(['/', '\\'])
        .find(|p| !p.is_empty())
        .unwrap_or(path)
        .to_owned()
}

/// Lines in a text, as an editor counts them.
fn lines(text: &str) -> u32 {
    if text.is_empty() {
        0
    } else {
        text.lines().count().max(1) as u32
    }
}

/// The few fields of a Claude Code hook event the island shows.
pub fn extract(source: &str, event: &Value) -> Option<Message> {
    let text = |key: &str| event.get(key).and_then(Value::as_str);
    let name = text("hook_event_name")?;
    let session = text("session_id")?;
    let tool = text("tool_name").map(str::to_owned);
    let input = event.get("tool_input");
    let field = |key: &str| input.and_then(|i| i.get(key)).and_then(Value::as_str);
    let target = match tool.as_deref() {
        Some("Edit" | "MultiEdit" | "Write" | "Read") => field("file_path").map(file_name),
        Some("NotebookEdit") => field("notebook_path").map(file_name),
        Some("Bash" | "PowerShell") => field("command").map(|c| short(c, 80)),
        Some("Grep" | "Glob") => field("pattern").map(|p| short(p, 60)),
        Some("WebFetch") => field("url").map(|u| {
            let host = u.split("://").nth(1).unwrap_or(u);
            short(host.split('/').next().unwrap_or(host), 60)
        }),
        Some("WebSearch") => field("query").map(|q| short(q, 60)),
        Some("Task" | "Agent") => field("description").map(|d| short(d, 60)),
        Some("AskUserQuestion") => input
            .and_then(|i| i.get("questions"))
            .and_then(|q| q.get(0))
            .and_then(|q| q.get("question"))
            .and_then(Value::as_str)
            .map(|q| short(q, 120)),
        _ => None,
    };
    let mut message = Message {
        source: source.to_owned(),
        event: name.to_owned(),
        session: session.to_owned(),
        cwd: text("cwd").unwrap_or("").to_owned(),
        tool,
        target: target.filter(|t| !t.is_empty()),
        kind: (name == "Notification")
            .then(|| text("notification_type"))
            .flatten()
            .map(str::to_owned),
        ..Message::default()
    };
    // What the step can open from the island: kept in memory, never logged.
    if matches!(name, "PreToolUse" | "PermissionRequest") {
        message.link = match message.tool.as_deref() {
            Some("Edit" | "MultiEdit" | "Write" | "Read") => {
                field("file_path").map(|p| cut(p, 1000))
            }
            Some("NotebookEdit") => field("notebook_path").map(|p| cut(p, 1000)),
            Some("WebFetch") => field("url").map(|u| cut(u, 2000)),
            Some("WebSearch") => field("query").map(|q| cut(q, 300)),
            _ => None,
        };
    }
    // What is asked, in full enough to decide on: shown on the island, never logged.
    if name == "PermissionRequest" {
        message.always = event
            .get("permission_suggestions")
            .and_then(Value::as_array)
            .is_some_and(|a| !a.is_empty());
        message.danger = matches!(message.tool.as_deref(), Some("Bash" | "PowerShell"))
            && field("command").is_some_and(dangerous);
        // An edit counts the lines it changes, not the size of the blocks replaced.
        let count =
            |diff: &[DiffLine], kind: &str| diff.iter().filter(|l| l.kind == kind).count() as u32;
        match message.tool.as_deref() {
            Some("Bash" | "PowerShell") => {
                message.detail = field("command")
                    .map(|c| cut(&c.split_whitespace().collect::<Vec<_>>().join(" "), 400));
            }
            Some("WebFetch") => message.detail = field("url").map(|u| cut(u, 200)),
            Some("Edit") => {
                let diff = diff_lines(
                    field("old_string").unwrap_or(""),
                    field("new_string").unwrap_or(""),
                );
                message.added = Some(count(&diff, "+"));
                message.removed = Some(count(&diff, "-"));
                message.diff = bounded(diff);
            }
            Some("MultiEdit") => {
                let edits = input.and_then(|i| i.get("edits")).and_then(Value::as_array);
                let text = |e: &Value, key: &str| {
                    e.get(key).and_then(Value::as_str).unwrap_or("").to_owned()
                };
                let mut all = Vec::new();
                for (i, e) in edits.into_iter().flatten().enumerate() {
                    if i > 0 {
                        all.push(line(" ", "…"));
                    }
                    all.extend(diff_lines(&text(e, "old_string"), &text(e, "new_string")));
                }
                message.added = Some(count(&all, "+"));
                message.removed = Some(count(&all, "-"));
                message.diff = bounded(all);
            }
            Some("Write") => {
                message.added = field("content").map(lines);
                message.diff = bounded(
                    field("content")
                        .unwrap_or("")
                        .lines()
                        .map(|l| line("+", l))
                        .collect(),
                );
            }
            Some("ExitPlanMode") => message.detail = field("plan").map(|p| cut(p.trim(), 1500)),
            Some("AskUserQuestion") => message.questions = questions_of(input),
            _ => {}
        }
    }
    Some(message)
}

/* ------------------------------------------------------------- Sessions */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum State {
    /// Open, waiting for a first prompt.
    Ready,
    Working,
    /// Waiting for its user to allow something.
    Waiting,
    /// Asking its user a question.
    Question,
    Done,
    Failed,
}

/// A permission the island asks for, the agent waiting. Mirrors
/// `AgentRequest` in `src/ipc/agents.ts`.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    pub id: u64,
    pub tool: Option<String>,
    pub target: Option<String>,
    pub detail: Option<String>,
    pub added: Option<u32>,
    pub removed: Option<u32>,
    /// A question to answer by picking options, instead of allowing.
    pub questions: Option<Vec<Question>>,
    /// For a change to a file: its lines, removed and added.
    pub diff: Option<Vec<DiffLine>>,
    /// "Always allow" is offered (the agent's own suggestion, never for a danger).
    pub always: bool,
    /// A command that destroys or rewrites: allowed only by a held press.
    pub danger: bool,
}

/// One step of a session: a file read, a page fetched, a command run.
/// Mirrors `AgentAction` in `src/ipc/agents.ts`.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Action {
    pub tool: String,
    pub target: Option<String>,
    /// What it opens: a path, an address, a search.
    pub link: Option<String>,
    pub failed: bool,
    pub at: u64,
}

/// Mirrors `AgentSession` in `src/ipc/agents.ts`.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub agent: String,
    /// The project's folder name.
    pub project: String,
    pub state: State,
    pub tool: Option<String>,
    pub target: Option<String>,
    /// Since when (ms since 1970) it is in this state, or working on this turn.
    pub since: u64,
    /// A permission waiting for an answer on the island.
    pub request: Option<Request>,
    /// Whether a click can bring its window back.
    pub can_focus: bool,
    /// Its latest steps, newest first.
    pub recent: Vec<Action>,
    /// When it was first heard from (ms since 1970): the list keeps this order.
    pub created: u64,
    /// How full its context window is (0-100), from the status line.
    pub context: Option<f64>,
    #[serde(skip)]
    window: Option<i64>,
    /// Its folder, where a new agent for the same project starts.
    #[serde(skip)]
    cwd: String,
    #[serde(skip)]
    updated: u64,
    /// A tool started and has not finished: a long build is not a silence.
    #[serde(skip)]
    tool_running: bool,
}

static SESSIONS: LazyLock<Mutex<Vec<Session>>> = LazyLock::new(Mutex::default);

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Applies one message; true when the list changed.
pub fn apply(sessions: &mut Vec<Session>, message: Message, now: u64) -> bool {
    let at = sessions.iter().position(|s| s.id == message.session);
    if message.event == "SessionEnd" {
        return at.map(|i| sessions.remove(i)).is_some();
    }
    let index = match at {
        Some(i) => i,
        None => {
            if sessions.len() >= MAX_SESSIONS
                && let Some(oldest) = (0..sessions.len()).min_by_key(|&i| sessions[i].updated)
            {
                sessions.remove(oldest);
            }
            let project = file_name(&message.cwd);
            sessions.push(Session {
                id: message.session.clone(),
                agent: message.source.clone(),
                project: if project.is_empty() {
                    message.cwd.clone()
                } else {
                    project
                },
                state: State::Ready,
                tool: None,
                target: None,
                since: now,
                request: None,
                can_focus: false,
                recent: Vec::new(),
                created: now,
                context: None,
                window: None,
                cwd: message.cwd.clone(),
                updated: now,
                tool_running: false,
            });
            sessions.len() - 1
        }
    };
    let before = sessions[index].clone();
    let session = &mut sessions[index];
    session.updated = now;
    if message.window.is_some() {
        session.window = message.window;
        session.can_focus = true;
    }
    let start_turn = |s: &mut Session| {
        if !matches!(s.state, State::Working | State::Waiting | State::Question) {
            s.since = now;
        }
        s.state = State::Working;
    };
    match message.event.as_str() {
        "UserPromptSubmit" => {
            session.state = State::Working;
            session.since = now;
            session.tool = None;
            session.target = None;
            session.tool_running = false;
        }
        "PreToolUse" => {
            if message.tool.as_deref() == Some("AskUserQuestion") {
                session.state = State::Question;
            } else {
                start_turn(session);
            }
            if let Some(tool) = message.tool.as_deref()
                && !matches!(tool, "AskUserQuestion" | "TodoWrite" | "ExitPlanMode")
            {
                let step = Action {
                    tool: tool.to_owned(),
                    target: message.target.clone(),
                    link: message.link.clone(),
                    failed: false,
                    at: now,
                };
                let same = session.recent.first().is_some_and(|a| {
                    a.tool == step.tool && a.target == step.target && a.link == step.link
                });
                if same {
                    session.recent[0] = step;
                } else {
                    session.recent.insert(0, step);
                    session.recent.truncate(MAX_ACTIONS);
                }
            }
            session.tool = message.tool;
            session.target = message.target;
            session.tool_running = true;
        }
        "PermissionRequest" => {
            // Asking a question goes through a permission too: it stays a question.
            session.state = if message.tool.as_deref() == Some("AskUserQuestion") {
                State::Question
            } else {
                State::Waiting
            };
            if message.tool.is_some() {
                session.tool = message.tool;
                session.target = message.target;
            }
        }
        "PostToolUse" | "PostToolUseFailure" => {
            start_turn(session);
            session.tool_running = false;
            if message.event == "PostToolUseFailure"
                && let Some(step) = session.recent.first_mut()
                && Some(&step.tool) == message.tool.as_ref()
            {
                step.failed = true;
            }
        }
        "Notification" if message.kind.as_deref() == Some("permission_prompt") => {
            if session.state != State::Question {
                session.state = State::Waiting;
            }
        }
        "Stop" => {
            session.state = State::Done;
            session.since = now;
            session.tool_running = false;
            session.request = None;
        }
        "StopFailure" => {
            session.state = State::Failed;
            session.since = now;
            session.tool_running = false;
            session.request = None;
        }
        _ => {}
    }
    // The time it was last heard from alone does not change what is shown.
    let mut after = sessions[index].clone();
    after.updated = before.updated;
    after != before || at.is_none()
}

/// Settles sessions gone quiet; true when the list changed.
pub fn sweep(sessions: &mut Vec<Session>, now: u64) -> bool {
    let quiet = |s: &Session| Duration::from_millis(now.saturating_sub(s.updated));
    let count = sessions.len();
    sessions.retain(|s| {
        !(matches!(s.state, State::Ready | State::Done | State::Failed) && quiet(s) > KEEP_DONE)
    });
    let mut changed = sessions.len() != count;
    for s in sessions.iter_mut() {
        if s.request.is_some() {
            continue;
        }
        let limit = match s.state {
            State::Working if !s.tool_running => STALE_WORKING,
            State::Working | State::Waiting | State::Question => STALE_TOOL,
            _ => continue,
        };
        if quiet(s) > limit {
            s.state = State::Ready;
            s.since = now;
            s.tool_running = false;
            changed = true;
        }
    }
    changed
}

/// The usage of each agent's limits, as last heard. Mirrors `AgentUsage` in `src/ipc/agents.ts`.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[derive(Deserialize)]
pub struct Usage {
    pub agent: String,
    pub windows: Vec<UsageWindow>,
    /// When it was last heard (ms since 1970): an old reading says so.
    #[serde(default)]
    pub updated: u64,
}

static USAGE: LazyLock<Mutex<Vec<Usage>>> = LazyLock::new(Mutex::default);

/// Readings of each limit (agent, length) over the last hours: how fast it fills.
/// Readings of one limit: when (ms since 1970), and how much was used.
type Readings = Vec<(u64, f64)>;
static SAMPLES: LazyLock<Mutex<HashMap<(String, u32), Readings>>> = LazyLock::new(Mutex::default);
/// How far back the pace is measured, and the least span it needs.
const PACE_SPAN: Duration = Duration::from_secs(60 * 60);
const PACE_MIN: Duration = Duration::from_secs(5 * 60);

/// At this pace, minutes until the limit is reached; None when it is not
/// filling, or would reset first.
pub fn full_in(samples: &[(u64, f64)], now: u64, resets_at: Option<u64>) -> Option<u32> {
    let &(t1, u1) = samples.last()?;
    let &(t0, u0) = samples
        .iter()
        .find(|(t, _)| now.saturating_sub(*t) <= PACE_SPAN.as_millis() as u64)?;
    let span = t1.saturating_sub(t0);
    if span < PACE_MIN.as_millis() as u64 || u1 <= u0 || u1 >= 100.0 {
        return None;
    }
    let per_ms = (u1 - u0) / span as f64;
    let minutes = ((100.0 - u1) / per_ms / 60_000.0).ceil() as u64;
    let reset_in = resets_at.map(|at| (at * 1000).saturating_sub(now) / 60_000);
    (reset_in.is_none_or(|r| minutes < r)).then_some(minutes.min(u32::MAX as u64) as u32)
}

/// Records an agent's usage; true when what the island shows changed.
fn set_usage(agent: &str, windows: Vec<UsageWindow>) -> bool {
    let now = now_ms();
    let mut samples = SAMPLES.lock().unwrap_or_else(|e| e.into_inner());
    let windows: Vec<UsageWindow> = windows
        .into_iter()
        .filter(|w| w.resets_at.is_none_or(|at| at * 1000 > now))
        .map(|mut w| {
            let list = samples.entry((agent.to_owned(), w.minutes)).or_default();
            // A reset (the share fell): the pace starts over.
            if list.last().is_some_and(|&(_, used)| w.used < used) {
                list.clear();
            }
            list.push((now, w.used));
            list.retain(|(t, _)| now.saturating_sub(*t) <= 3 * PACE_SPAN.as_millis() as u64);
            w.full_in = full_in(list, now, w.resets_at);
            w
        })
        .collect();
    drop(samples);
    let mut all = USAGE.lock().unwrap_or_else(|e| e.into_inner());
    let before: Vec<(String, Vec<UsageWindow>)> = all
        .iter()
        .map(|u| (u.agent.clone(), u.windows.clone()))
        .collect();
    all.retain(|u| u.agent != agent);
    if !windows.is_empty() {
        all.push(Usage {
            agent: agent.to_owned(),
            windows,
            updated: now,
        });
        all.sort_by(|a, b| a.agent.cmp(&b.agent));
    }
    let after: Vec<(String, Vec<UsageWindow>)> = all
        .iter()
        .map(|u| (u.agent.clone(), u.windows.clone()))
        .collect();
    after != before
}

/// Where the last readings are kept between two starts (numbers only).
fn usage_file(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|d| d.join("agents-usage.json"))
}

fn save_usage(app: &AppHandle) {
    let all = USAGE.lock().unwrap_or_else(|e| e.into_inner()).clone();
    if let (Some(path), Ok(text)) = (usage_file(app), serde_json::to_string(&all)) {
        if let Some(dir) = path.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let _ = std::fs::write(path, text);
    }
}

/// The last readings, as they were before Quiera closed, without the
/// limits that have reset since.
fn load_usage(app: &AppHandle) {
    let Some(text) = usage_file(app).and_then(|p| std::fs::read_to_string(p).ok()) else {
        return;
    };
    let Ok(mut saved) = serde_json::from_str::<Vec<Usage>>(&text) else {
        return;
    };
    let now = now_ms();
    for u in &mut saved {
        u.windows
            .retain(|w| w.resets_at.is_none_or(|at| at * 1000 > now));
        for w in &mut u.windows {
            w.full_in = None;
        }
    }
    saved.retain(|u| !u.windows.is_empty());
    *USAGE.lock().unwrap_or_else(|e| e.into_inner()) = saved;
}

fn publish_usage(app: &AppHandle) {
    let all = USAGE.lock().unwrap_or_else(|e| e.into_inner()).clone();
    let _ = app.emit(USAGE_EVENT, all);
}

#[tauri::command]
pub fn agents_usage() -> Vec<Usage> {
    if !crate::settings::get().agents.usage {
        return Vec::new();
    }
    USAGE.lock().unwrap_or_else(|e| e.into_inner()).clone()
}

/// Codex keeps its limits in its session records (`~/.codex/sessions`):
/// the newest one's last word on them, read now and then. Only numbers are read.
fn read_codex_usage(app: &AppHandle) -> Option<Vec<UsageWindow>> {
    let home = match std::env::var_os("CODEX_HOME") {
        Some(dir) if !dir.is_empty() => PathBuf::from(dir),
        _ => app.path().home_dir().ok()?.join(".codex"),
    };
    // Year, month, day: the newest folder at each level.
    let mut dir = home.join("sessions");
    for _ in 0..3 {
        dir = std::fs::read_dir(&dir)
            .ok()?
            .flatten()
            .filter(|e| e.path().is_dir())
            .map(|e| e.path())
            .max()?;
    }
    let newest = std::fs::read_dir(&dir)
        .ok()?
        .flatten()
        .filter(|e| e.path().extension().is_some_and(|x| x == "jsonl"))
        .max_by_key(|e| e.metadata().and_then(|m| m.modified()).ok())?
        .path();
    let text = std::fs::read(&newest).ok()?;
    let tail = &text[text.len().saturating_sub(512 * 1024)..];
    let tail = String::from_utf8_lossy(tail);
    tail.lines()
        .rev()
        .filter(|l| l.contains("\"rate_limits\""))
        .find_map(|l| {
            let record: Value = serde_json::from_str(l).ok()?;
            let limits = record
                .get("payload")
                .and_then(|p| p.get("rate_limits"))
                .or_else(|| record.get("rate_limits"))?;
            Some(codex_usage(limits))
        })
}

fn sessions() -> std::sync::MutexGuard<'static, Vec<Session>> {
    SESSIONS.lock().unwrap_or_else(|e| e.into_inner())
}

fn publish(app: &AppHandle) {
    let list = sessions().clone();
    let _ = app.emit(SESSIONS_EVENT, list);
}

/* ------------------------------------------------------------- Permissions */

/// The user's answer to a permission, from the island.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Decision {
    Allow,
    Deny,
    /// Answer in the terminal instead: its own question comes back.
    Terminal,
}

/// One question's answer: options picked (by position), or typed text.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Pick {
    Options(Vec<usize>),
    Text(String),
}

/// An answer from the island: the decision, for a question the picks
/// (one per question), and whether to stop asking for this.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Answer {
    pub decision: Decision,
    pub picked: Option<Vec<Pick>>,
    pub always: bool,
}

/// The permissions waiting on the island, by request id.
static PENDING: LazyLock<Mutex<HashMap<u64, Sender<Answer>>>> = LazyLock::new(Mutex::default);
static NEXT_REQUEST: AtomicU64 = AtomicU64::new(1);

/// The reply sent back to the hook, which words it for Claude Code
/// (`claude_output`). None: the question goes back to the terminal.
pub fn reply_json(answer: &Answer) -> Option<String> {
    match answer.decision {
        Decision::Allow => Some(match &answer.picked {
            Some(picked) => json!({ "behavior": "allow", "answers": picked }),
            None if answer.always => json!({ "behavior": "allow", "always": true }),
            None => json!({ "behavior": "allow" }),
        }),
        Decision::Deny => Some(json!({ "behavior": "deny" })),
        Decision::Terminal => None,
    }
    .map(|v| v.to_string())
}

/// Whether picks answer these questions: one option each, or at least one
/// where several are allowed, all among the options offered; or typed text.
pub fn valid_picks(questions: &[Question], picked: &[Pick]) -> bool {
    questions.len() == picked.len()
        && questions.iter().zip(picked).all(|(q, p)| match p {
            Pick::Text(text) => !text.trim().is_empty() && text.chars().count() <= 2000,
            Pick::Options(p) => {
                let count_ok = if q.multi_select {
                    !p.is_empty()
                } else {
                    p.len() == 1
                };
                count_ok && p.iter().all(|&i| i < q.options.len())
            }
        })
}

/// A permission or a question asked: the island asks instead, until its
/// user answers (Terminal sends it back to the agent's own window), the
/// agent gives up, or nobody answers for a long while.
fn ask(app: &AppHandle, message: Message, alive: &dyn Fn() -> bool) -> Option<String> {
    let session_id = message.session.clone();
    let request = Request {
        id: NEXT_REQUEST.fetch_add(1, Ordering::Relaxed),
        tool: message.tool.clone(),
        target: message.target.clone(),
        detail: message.detail.clone(),
        added: message.added,
        removed: message.removed,
        questions: message.questions.clone(),
        diff: message.diff.clone(),
        always: message.always && !message.danger && message.source == "claude",
        danger: message.danger,
    };
    // A question the island cannot show in full goes to the terminal.
    let unanswerable =
        message.tool.as_deref() == Some("AskUserQuestion") && request.questions.is_none();
    if unanswerable {
        log::info!("agents: a question the island cannot show went to the terminal");
    }
    apply(&mut sessions(), message, now_ms());
    let hold = crate::settings::get().agents.approve && !unanswerable;
    if !hold {
        publish(app);
        return None;
    }
    let id = request.id;
    log::info!("agents: a permission is asked on the island");
    let (send, receive) = mpsc::channel();
    PENDING
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .insert(id, send);
    set_request(&session_id, Some(request));
    publish(app);

    let started = Instant::now();
    // Why it ended, for the log: never what was asked.
    let back = Answer {
        decision: Decision::Terminal,
        picked: None,
        always: false,
    };
    let (answer, why) = loop {
        match receive.recv_timeout(HOLD_CHECK) {
            Ok(answer) => break (answer, "answered on the island"),
            Err(mpsc::RecvTimeoutError::Disconnected) => break (back, "dropped"),
            Err(mpsc::RecvTimeoutError::Timeout) => {}
        }
        if !alive() {
            break (back, "the agent stopped waiting");
        }
        if started.elapsed() > HOLD_AT_MOST {
            break (back, "nobody answered");
        }
    };
    let decision = answer.decision;
    log::info!("agents: a permission asked on the island ended ({why}): {decision:?}");
    PENDING
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .remove(&id);
    {
        let mut list = sessions();
        if let Some(s) = list.iter_mut().find(|s| s.id == session_id) {
            s.request = None;
            if decision != Decision::Terminal {
                s.state = State::Working;
            }
        }
    }
    publish(app);
    reply_json(&answer)
}

fn set_request(session: &str, request: Option<Request>) {
    if let Some(s) = sessions().iter_mut().find(|s| s.id == session) {
        s.request = request;
    }
}

/// The island's answer to a permission, or to a question (`picked`: one
/// per question, options by position or typed text). `always`: stop asking
/// for this, as the agent suggested (never for a danger).
#[tauri::command]
pub fn agents_decide(
    id: u64,
    decision: Decision,
    picked: Option<Vec<Pick>>,
    always: Option<bool>,
) -> bool {
    let request = sessions()
        .iter()
        .find_map(|s| s.request.clone().filter(|r| r.id == id));
    let Some(request) = request else {
        return false;
    };
    let always = always == Some(true);
    if decision == Decision::Allow {
        let fits = match (&request.questions, &picked) {
            (Some(q), Some(p)) => valid_picks(q, p),
            (None, None) => !always || request.always,
            _ => false,
        };
        if !fits {
            return false;
        }
    }
    let picked = if decision == Decision::Allow {
        picked
    } else {
        None
    };
    let window = (decision == Decision::Terminal)
        .then(|| {
            sessions()
                .iter()
                .find(|s| s.request.as_ref().is_some_and(|r| r.id == id))
                .and_then(|s| s.window)
        })
        .flatten();
    let sent = PENDING
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .get(&id)
        .is_some_and(|send| {
            send.send(Answer {
                decision,
                picked,
                always: always && decision == Decision::Allow,
            })
            .is_ok()
        });
    if let Some(window) = window {
        crate::platform::focus_window(window as isize);
    }
    sent
}

/// Opens what a session's step worked on: its file, its page, its search.
#[tauri::command]
pub fn agents_open(app: AppHandle, session: String, index: usize) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let step = sessions()
        .iter()
        .find(|s| s.id == session)
        .and_then(|s| s.recent.get(index).cloned())
        .ok_or("this step is gone")?;
    let link = step.link.ok_or("nothing to open")?;
    let opener = app.opener();
    match step.tool.as_str() {
        "WebFetch" if link.starts_with("https://") || link.starts_with("http://") => {
            opener.open_url(link, None::<&str>)
        }
        "WebFetch" => return Err("not a web address".into()),
        "WebSearch" => {
            let url =
                tauri::Url::parse_with_params("https://www.google.com/search", &[("q", &link)])
                    .map_err(|e| e.to_string())?;
            opener.open_url(url.as_str(), None::<&str>)
        }
        _ if Path::new(&link).exists() => opener.open_path(link, None::<&str>),
        _ => return Err("this file is gone".into()),
    }
    .map_err(|e| e.to_string())
}

/// Brings a session's window (its terminal, its editor) to the front.
#[tauri::command]
pub fn agents_focus(id: String) -> bool {
    let window = sessions()
        .iter()
        .find(|s| s.id == id)
        .and_then(|s| s.window);
    window.is_some_and(|w| crate::platform::focus_window(w as isize))
}

/// Development aid: an answer sent through the pipe, as a test would click.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DevDecide {
    dev_decide: u64,
    decision: Decision,
    #[serde(default)]
    picked: Option<Vec<Pick>>,
    #[serde(default)]
    always: Option<bool>,
}

/// Development aid: open the island on a tab, as a test would by hovering.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DevOpen {
    dev_open: String,
}

/// Development aid: the window found for a session, as a test checks it.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DevWindow {
    dev_window: String,
}

pub fn start(app: &AppHandle) {
    let handle = app.clone();
    crate::platform::serve_agent_pipe(move |line, alive| {
        if cfg!(debug_assertions)
            && let Ok(dev) = serde_json::from_str::<DevDecide>(&line)
        {
            agents_decide(dev.dev_decide, dev.decision, dev.picked, dev.always);
            return None;
        }
        if cfg!(debug_assertions)
            && let Ok(dev) = serde_json::from_str::<DevOpen>(&line)
        {
            match dev.dev_open.as_str() {
                "settings" => crate::settings::open_window_at(&handle, Some("agents")),
                "phone" => {
                    return crate::agents_phone::agents_phone_start()
                        .ok()
                        .map(|l| l.url);
                }
                tab => {
                    let _ = handle.emit("island://dev-open", tab);
                }
            }
            return None;
        }
        if cfg!(debug_assertions)
            && let Ok(dev) = serde_json::from_str::<DevWindow>(&line)
        {
            if dev.dev_window == "usage" {
                let all = USAGE.lock().unwrap_or_else(|e| e.into_inner()).clone();
                return serde_json::to_string(&all).ok();
            }
            let found: Vec<Value> = sessions()
                .iter()
                .filter(|s| dev.dev_window == "*" || s.id == dev.dev_window)
                .map(|s| {
                    let title = s.window.map(|w| crate::platform::window_title(w as isize));
                    let front = s.window.is_some_and(|w| crate::platform::window_in_front(w as isize));
                    json!({ "project": s.project, "window": s.window, "title": title, "front": front, "request": s.request.as_ref().map(|r| r.id) })
                })
                .collect();
            return Some(Value::Array(found).to_string());
        }
        let message = serde_json::from_str::<Message>(&line).ok()?;
        if cfg!(debug_assertions) && message.event != "Usage" {
            log::info!(
                "[dev] agents: {} {} {}",
                message.source,
                message.event,
                message.tool.as_deref().unwrap_or("")
            );
        }
        if message.event == "Usage" {
            if let Some(context) = message.context {
                let changed = sessions()
                    .iter_mut()
                    .find(|s| s.id == message.session)
                    .is_some_and(|s| {
                        let rounded = Some(context.round());
                        let changed = s.context != rounded;
                        s.context = rounded;
                        changed
                    });
                if changed {
                    publish(&handle);
                }
            }
            if crate::settings::get().agents.usage
                && let Some(usage) = message.usage
                && set_usage(&message.source, usage)
            {
                publish_usage(&handle);
                save_usage(&handle);
            }
            return None;
        }
        if message.event == "PermissionRequest" {
            return ask(&handle, message, alive);
        }
        let changed = apply(&mut sessions(), message, now_ms());
        if changed {
            publish(&handle);
        }
        None
    });
    let handle = app.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(SWEEP_EVERY);
            let changed = sweep(&mut sessions(), now_ms());
            if changed {
                publish(&handle);
            }
        }
    });
    load_usage(app);
    let handle = app.clone();
    std::thread::spawn(move || look_for_claude(&handle));
    let handle = app.clone();
    std::thread::spawn(move || {
        loop {
            if crate::settings::get().agents.usage
                && let Some(windows) = read_codex_usage(&handle)
                && set_usage("codex", windows)
            {
                publish_usage(&handle);
                save_usage(&handle);
            }
            std::thread::sleep(READ_CODEX_EVERY);
        }
    });
    // Quiera moved (a new install folder), or listens to more than it did:
    // the hooks follow. Not from a development build, which would point
    // them at itself.
    if cfg!(debug_assertions) {
        return;
    }
    let handle = app.clone();
    std::thread::spawn(move || {
        let Some(exe) = current_exe() else { return };
        if let Some(path) = claude_settings_path(&handle)
            && let Ok(Some(config)) = read_config(&path)
            && hooked(&config, &exe) != Hooked::No
            && outdated(&config, &exe)
        {
            match set_claude(&path, &exe, true) {
                Ok(()) => log::info!("agents: Claude Code's hooks updated"),
                Err(e) => log::warn!("agents: could not update Claude Code's hooks: {e}"),
            }
        }
        if let Some(path) = codex_hooks_path(&handle)
            && let Ok(Some(config)) = read_config(&path)
            && hooked(&config, &exe) != Hooked::No
        {
            let mut current = config.clone();
            codex_hook(&mut current, &exe);
            if current != config {
                match write_config(&path, |c| codex_hook(c, &exe)) {
                    Ok(()) => log::info!("agents: Codex's hooks updated"),
                    Err(e) => log::warn!("agents: could not update Codex's hooks: {e}"),
                }
            }
        }
    });
}

/// Claude Code installed but not listened to: when it starts, the island
/// offers to listen (once per run, and never again once answered).
fn look_for_claude(app: &AppHandle) {
    std::thread::sleep(Duration::from_secs(5));
    loop {
        if crate::settings::get().agents.claude_asked {
            return;
        }
        match claude_status(app) {
            "off" => {
                if crate::platform::process_running("claude.exe") {
                    log::info!("agents: Claude Code started; offering to listen to it");
                    let _ = app.emit(OFFER_EVENT, "claude");
                    return;
                }
            }
            "on" => return,
            _ => {}
        }
        std::thread::sleep(LOOK_FOR_CLAUDE);
    }
}

#[tauri::command]
pub fn agents_sessions() -> Vec<Session> {
    sessions().clone()
}

/* ------------------------------------------------------------- Claude Code's settings */

/// The hook events Quiera listens to, and whether each is about a tool.
const CLAUDE_EVENTS: [(&str, bool); 10] = [
    ("SessionStart", false),
    ("UserPromptSubmit", false),
    ("PreToolUse", true),
    ("PermissionRequest", true),
    ("PostToolUse", true),
    ("PostToolUseFailure", true),
    ("Notification", false),
    ("Stop", false),
    ("StopFailure", false),
    ("SessionEnd", false),
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Hooked {
    No,
    Yes,
    /// Hooked, but to a Quiera that is no longer there.
    Elsewhere,
}

/// Quiera's hook: run with `--agent-event` (in its arguments for Claude
/// Code, in its command line for Codex).
fn is_ours(hook: &Value) -> bool {
    hook.get("args")
        .and_then(Value::as_array)
        .and_then(|a| a.first())
        .and_then(Value::as_str)
        == Some(EVENT_ARG)
        || hook
            .get("command")
            .and_then(Value::as_str)
            .is_some_and(|c| c.contains(EVENT_ARG))
}

/// The executable a hook runs: Claude Code's `command`, or the path quoted
/// in Codex's PowerShell line.
fn hook_exe(hook: &Value) -> Option<String> {
    let command = hook.get("command")?.as_str()?;
    if hook.get("args").is_some() {
        return Some(command.to_owned());
    }
    let start = command.find("& \"")? + 3;
    let end = start + command[start..].find('"')?;
    Some(command[start..end].to_owned())
}

/// Whether Claude Code's settings run Quiera, and this copy of it.
pub fn hooked(config: &Value, exe: &str) -> Hooked {
    let ours: Vec<&Value> = config
        .get("hooks")
        .and_then(Value::as_object)
        .into_iter()
        .flat_map(|events| events.values())
        .filter_map(Value::as_array)
        .flatten()
        .filter_map(|group| group.get("hooks").and_then(Value::as_array))
        .flatten()
        .filter(|hook| is_ours(hook))
        .collect();
    if ours.is_empty() {
        Hooked::No
    } else if ours.iter().all(|h| hook_exe(h).as_deref() == Some(exe)) {
        Hooked::Yes
    } else {
        Hooked::Elsewhere
    }
}

/// Hooked differently than this Quiera would hook (another folder, fewer events).
pub fn outdated(config: &Value, exe: &str) -> bool {
    let mut current = config.clone();
    hook(&mut current, exe);
    let mut ours_now = config.clone();
    let mut ours_expected = current;
    // Compare Quiera's part only: the user's hooks are the same in both.
    keep_ours(&mut ours_now);
    keep_ours(&mut ours_expected);
    ours_now != ours_expected
}

/// The status line Quiera sets: a command any shell runs as it is (Claude
/// Code runs it through Git Bash or PowerShell), so a path with forward
/// slashes and no space (its short form). None when there is no such path.
fn status_command(exe: &str) -> Option<String> {
    let path = crate::platform::short_path(exe)
        .unwrap_or_else(|| exe.to_owned())
        .replace('\\', "/");
    (!path.contains(' ')).then(|| format!("{path} {STATUS_ARG} claude"))
}

/// Whether a status line is Quiera's.
fn is_our_status(config: &Value) -> bool {
    config
        .get("statusLine")
        .and_then(|s| s.get("command"))
        .and_then(Value::as_str)
        .is_some_and(|c| c.contains(STATUS_ARG))
}

fn keep_ours(config: &mut Value) {
    let status = is_our_status(config).then(|| config["statusLine"].clone());
    let Some(events) = config.get_mut("hooks").and_then(Value::as_object_mut) else {
        *config = json!({ "statusLine": status });
        return;
    };
    for groups in events.values_mut() {
        if let Some(list) = groups.as_array_mut() {
            list.retain(|g| {
                g.get("hooks")
                    .and_then(Value::as_array)
                    .is_some_and(|h| h.iter().any(is_ours))
            });
        }
    }
    events.retain(|_, g| g.as_array().is_some_and(|g| !g.is_empty()));
    *config =
        json!({ "hooks": config.get("hooks").cloned().unwrap_or(json!({})), "statusLine": status });
}

/// Removes Quiera's hooks, and only those, leaving the rest as it was.
pub fn unhook(config: &mut Value) {
    if is_our_status(config)
        && let Some(object) = config.as_object_mut()
    {
        object.shift_remove("statusLine");
    }
    let Some(events) = config.get_mut("hooks").and_then(Value::as_object_mut) else {
        return;
    };
    for groups in events.values_mut() {
        let Some(list) = groups.as_array_mut() else {
            continue;
        };
        for group in list.iter_mut() {
            if let Some(hooks) = group.get_mut("hooks").and_then(Value::as_array_mut) {
                hooks.retain(|h| !is_ours(h));
            }
        }
        list.retain(|g| {
            g.get("hooks")
                .and_then(Value::as_array)
                .is_none_or(|h| !h.is_empty())
        });
    }
    events.retain(|_, groups| groups.as_array().is_none_or(|g| !g.is_empty()));
    if events.is_empty()
        && let Some(object) = config.as_object_mut()
    {
        object.shift_remove("hooks");
    }
}

/// Adds Quiera's hooks (once: old ones are replaced).
pub fn hook(config: &mut Value, exe: &str) {
    unhook(config);
    if !config.is_object() {
        *config = json!({});
    }
    let object = config.as_object_mut().expect("an object");
    let events = object.entry("hooks").or_insert_with(|| json!({}));
    if !events.is_object() {
        *events = json!({});
    }
    let events = events.as_object_mut().expect("an object");
    for (event, about_tools) in CLAUDE_EVENTS {
        let asks = event == "PermissionRequest";
        let mut command = json!({
            "type": "command",
            "command": exe,
            "args": [EVENT_ARG, "claude"],
            // A permission waits for its user's answer on the island.
            "timeout": if asks { 3600 } else { 10 },
        });
        // In the background: the agent never waits for the island. Not a
        // permission (its answer is awaited), nor the end of a session
        // (which would not wait for it to run).
        if !asks && event != "SessionEnd" {
            command["async"] = json!(true);
        }
        let mut group = json!({ "hooks": [command] });
        if about_tools {
            group["matcher"] = json!("*");
        }
        let list = events.entry(event).or_insert_with(|| json!([]));
        if !list.is_array() {
            *list = json!([]);
        }
        list.as_array_mut().expect("an array").push(group);
    }
    // The usage of the subscription's limits comes through the status line:
    // set only where the user has none of their own.
    if config.get("statusLine").is_none()
        && let Some(command) = status_command(exe)
    {
        config["statusLine"] = json!({ "type": "command", "command": command, "padding": 0 });
    }
}

fn current_exe() -> Option<String> {
    std::env::current_exe()
        .ok()
        .map(|p| p.to_string_lossy().into_owned())
}

/// `settings.json` in Claude Code's folder (`CLAUDE_CONFIG_DIR`, or `~/.claude`).
fn claude_settings_path(app: &AppHandle) -> Option<PathBuf> {
    let dir = match std::env::var_os("CLAUDE_CONFIG_DIR") {
        Some(dir) if !dir.is_empty() => PathBuf::from(dir),
        _ => app.path().home_dir().ok()?.join(".claude"),
    };
    Some(dir.join("settings.json"))
}

/// The settings, `None` when there is no file yet.
fn read_config(path: &Path) -> Result<Option<Value>, String> {
    match std::fs::read_to_string(path) {
        Ok(text) if text.trim().is_empty() => Ok(Some(json!({}))),
        Ok(text) => serde_json::from_str(&text)
            .map(Some)
            .map_err(|_| "unreadable".to_owned()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Hooks Quiera into Claude Code, or out.
fn set_claude(path: &Path, exe: &str, on: bool) -> Result<(), String> {
    write_config(path, |config| {
        if on {
            hook(config, exe)
        } else {
            unhook(config)
        }
    })
}

/// Changes an agent's settings file. The file is kept once as it was
/// (`<name>.quiera-backup`), and replaced in one move, never half-written.
fn write_config(path: &Path, change: impl FnOnce(&mut Value)) -> Result<(), String> {
    let dir = path.parent().ok_or("no folder")?;
    if !dir.is_dir() {
        return Err("missing".into());
    }
    let existing = read_config(path)?;
    let mut config = existing.clone().unwrap_or_else(|| json!({}));
    change(&mut config);
    if existing.as_ref() == Some(&config) {
        return Ok(());
    }
    if existing.is_some() {
        let backup = path.with_extension("json.quiera-backup");
        if !backup.exists() {
            std::fs::copy(path, &backup).map_err(|e| e.to_string())?;
        }
    }
    let mut text = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    text.push('\n');
    let temporary = path.with_extension("json.quiera-tmp");
    std::fs::write(&temporary, text).map_err(|e| e.to_string())?;
    std::fs::rename(&temporary, path).map_err(|e| {
        let _ = std::fs::remove_file(&temporary);
        e.to_string()
    })
}

/// "on", "off", "missing" (no Claude Code), "unreadable" (its settings).
fn claude_status(app: &AppHandle) -> &'static str {
    let (Some(path), Some(exe)) = (claude_settings_path(app), current_exe()) else {
        return "missing";
    };
    if !path.parent().is_some_and(Path::is_dir) {
        return "missing";
    }
    match read_config(&path) {
        Ok(Some(config)) if hooked(&config, &exe) != Hooked::No => "on",
        Ok(_) => "off",
        Err(_) => "unreadable",
    }
}

/* ------------------------------------------------------------- Codex's hooks */

/// The Codex events Quiera listens to. Codex runs hooks through PowerShell
/// on Windows, and caps the end of a session at 3 seconds.
const CODEX_EVENTS: [&str; 7] = [
    "SessionStart",
    "UserPromptSubmit",
    "PreToolUse",
    "PermissionRequest",
    "PostToolUse",
    "Stop",
    "SessionEnd",
];

/// The PowerShell line Codex runs: it hands the event to Quiera on stdin
/// (PowerShell does not pass its own on), in UTF-8.
fn codex_command(exe: &str) -> String {
    format!(
        "[Console]::InputEncoding = [Text.UTF8Encoding]::new($false); $d = [Console]::In.ReadToEnd(); \
         $OutputEncoding = [Text.UTF8Encoding]::new($false); $d | & \"{exe}\" {EVENT_ARG} codex"
    )
}

/// Adds Quiera's hooks to Codex's `hooks.json` (once: old ones are replaced).
pub fn codex_hook(config: &mut Value, exe: &str) {
    unhook(config);
    if !config.is_object() {
        *config = json!({});
    }
    let object = config.as_object_mut().expect("an object");
    let events = object.entry("hooks").or_insert_with(|| json!({}));
    if !events.is_object() {
        *events = json!({});
    }
    let events = events.as_object_mut().expect("an object");
    for event in CODEX_EVENTS {
        let timeout = match event {
            "SessionEnd" => 3,
            "PermissionRequest" => 600,
            _ => 10,
        };
        let group = json!({ "hooks": [{ "type": "command", "command": codex_command(exe), "timeout": timeout }] });
        let list = events.entry(event).or_insert_with(|| json!([]));
        if !list.is_array() {
            *list = json!([]);
        }
        list.as_array_mut().expect("an array").push(group);
    }
}

/// `hooks.json` in Codex's folder (`CODEX_HOME`, or `~/.codex`).
fn codex_hooks_path(app: &AppHandle) -> Option<PathBuf> {
    let dir = match std::env::var_os("CODEX_HOME") {
        Some(dir) if !dir.is_empty() => PathBuf::from(dir),
        _ => app.path().home_dir().ok()?.join(".codex"),
    };
    Some(dir.join("hooks.json"))
}

/// "on", "off", "missing" (no Codex), "unreadable" (its hooks file).
fn codex_status(app: &AppHandle) -> &'static str {
    let (Some(path), Some(exe)) = (codex_hooks_path(app), current_exe()) else {
        return "missing";
    };
    if !path.parent().is_some_and(Path::is_dir) {
        return "missing";
    }
    match read_config(&path) {
        Ok(Some(config)) if hooked(&config, &exe) != Hooked::No => "on",
        Ok(_) => "off",
        Err(_) => "unreadable",
    }
}

/// Mirrors `AgentsStatus` in `src/ipc/agents.ts`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub claude: &'static str,
    pub codex: &'static str,
}

#[tauri::command]
pub fn agents_status(app: AppHandle) -> Status {
    Status {
        claude: claude_status(&app),
        codex: codex_status(&app),
    }
}

/// Hooks Quiera into an agent ("claude", the default, or "codex"), or out.
#[tauri::command]
pub fn agents_connect(app: AppHandle, on: bool, agent: Option<String>) -> Result<Status, String> {
    let exe = current_exe().ok_or("missing")?;
    let agent = agent.unwrap_or_else(|| "claude".into());
    let done = match agent.as_str() {
        "codex" => {
            let path = codex_hooks_path(&app).ok_or("missing")?;
            write_config(&path, |c| if on { codex_hook(c, &exe) } else { unhook(c) })
        }
        _ => {
            let path = claude_settings_path(&app).ok_or("missing")?;
            set_claude(&path, &exe, on)
        }
    };
    done.inspect_err(|e| log::warn!("agents: could not change {agent}'s hooks: {e}"))?;
    log::info!(
        "agents: {agent} {}",
        if on { "connected" } else { "disconnected" }
    );
    Ok(agents_status(app))
}

/// Whether Windows is in Do Not Disturb (sounds stay quiet then).
#[tauri::command]
pub fn agents_quiet() -> bool {
    crate::platform::notifications_quiet()
}

/// A sound for an agent's news: "done", or "waiting" for its user. Not in
/// Do Not Disturb, nor when the setting is off.
#[tauri::command]
pub fn agents_sound(kind: String) {
    if !crate::settings::get().agents.sound || crate::platform::notifications_quiet() {
        return;
    }
    let alias = match kind.as_str() {
        "waiting" => "Notification.Reminder",
        _ => "Notification.Default",
    };
    crate::platform::play_system_sound(alias);
}

/// Lets the island take the keyboard (an answer to type), or gives it back.
#[tauri::command]
pub fn agents_keyboard(app: AppHandle, take: bool) {
    if take {
        if let Some(island) = app.get_webview_window(crate::island::LABEL) {
            crate::platform::focus_island(&island);
        }
    } else {
        crate::platform::restore_focus();
    }
}

/* ------------------------------------------------------------- Starting an agent */

/// An agent's program on this PC: the native one, or npm's.
fn find_agent(agent: &str, home: Option<&Path>) -> Option<PathBuf> {
    let names = [format!("{agent}.exe"), format!("{agent}.cmd")];
    let mut dirs: Vec<PathBuf> = std::env::var_os("PATH")
        .map(|p| std::env::split_paths(&p).collect())
        .unwrap_or_default();
    if let Some(home) = home {
        dirs.push(home.join(".local").join("bin"));
    }
    if let Some(appdata) = std::env::var_os("APPDATA") {
        dirs.push(PathBuf::from(appdata).join("npm"));
    }
    names
        .iter()
        .find_map(|name| dirs.iter().map(|d| d.join(name)).find(|p| p.is_file()))
}

/// Starts an agent ("claude" or "codex") on a task, in a new terminal, in
/// the folder of the latest session of that agent (else the user's folder).
#[tauri::command]
pub fn agents_launch(app: AppHandle, agent: String, task: String) -> Result<(), String> {
    if !matches!(agent.as_str(), "claude" | "codex") {
        return Err("unknown agent".into());
    }
    let task = task.trim().to_owned();
    if task.is_empty() {
        return Err("empty".into());
    }
    let home = app.path().home_dir().ok();
    let program = find_agent(&agent, home.as_deref()).ok_or("missing")?;
    let folder = sessions()
        .iter()
        .filter(|s| s.agent == agent && Path::new(&s.cwd).is_dir())
        .max_by_key(|s| s.updated)
        .map(|s| PathBuf::from(&s.cwd))
        .or(home)
        .ok_or("no folder")?;
    crate::platform::start_in_terminal(&program, &task, &folder)?;
    log::info!("agents: {agent} started from the launcher");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn message(event: &str) -> Message {
        Message {
            source: "claude".into(),
            event: event.into(),
            session: "s1".into(),
            cwd: r"D:\code\quiera".into(),
            ..Message::default()
        }
    }

    #[test]
    fn keeps_a_files_name_never_its_content() {
        let event = json!({
            "hook_event_name": "PreToolUse",
            "session_id": "s1",
            "cwd": "/home/me/app",
            "tool_name": "Write",
            "tool_input": { "file_path": "/home/me/app/src/auth.ts", "content": "SECRET=1" }
        });
        let m = extract("claude", &event).unwrap();
        assert_eq!(m.target.as_deref(), Some("auth.ts"));
        assert!(!serde_json::to_string(&m).unwrap().contains("SECRET"));
    }

    #[test]
    fn shortens_commands_and_reads_questions() {
        let long = format!("npm test\n{}", "x".repeat(10));
        let bash = json!({ "hook_event_name": "PreToolUse", "session_id": "s", "tool_name": "Bash", "tool_input": { "command": long } });
        assert_eq!(
            extract("claude", &bash).unwrap().target.as_deref(),
            Some("npm test")
        );
        let ask = json!({
            "hook_event_name": "PreToolUse", "session_id": "s", "tool_name": "AskUserQuestion",
            "tool_input": { "questions": [{ "question": "Which target?", "options": [] }] }
        });
        assert_eq!(
            extract("claude", &ask).unwrap().target.as_deref(),
            Some("Which target?")
        );
        let web = json!({ "hook_event_name": "PreToolUse", "session_id": "s", "tool_name": "WebFetch", "tool_input": { "url": "https://docs.rs/serde/latest" } });
        assert_eq!(
            extract("claude", &web).unwrap().target.as_deref(),
            Some("docs.rs")
        );
        assert_eq!(short(&"é".repeat(90), 80).chars().count(), 80);
    }

    #[test]
    fn a_permission_carries_what_to_decide_on() {
        let bash = json!({
            "hook_event_name": "PermissionRequest", "session_id": "s", "tool_name": "Bash",
            "tool_input": { "command": "git push\n  --force origin main" }
        });
        let m = extract("claude", &bash).unwrap();
        assert_eq!(m.detail.as_deref(), Some("git push --force origin main"));
        let edit = json!({
            "hook_event_name": "PermissionRequest", "session_id": "s", "tool_name": "Edit",
            "tool_input": { "file_path": "a/b.ts", "old_string": "one", "new_string": "one\ntwo\nthree" }
        });
        let m = extract("claude", &edit).unwrap();
        assert_eq!(
            (m.target.as_deref(), m.added, m.removed),
            (Some("b.ts"), Some(2), Some(0))
        );
        // Other steps never carry the whole command.
        let pre = json!({ "hook_event_name": "PreToolUse", "session_id": "s", "tool_name": "Bash", "tool_input": { "command": "ls" } });
        assert_eq!(extract("claude", &pre).unwrap().detail, None);
    }

    fn answer(decision: Decision, picked: Option<Vec<Pick>>) -> Option<String> {
        reply_json(&Answer {
            decision,
            picked,
            always: false,
        })
    }

    fn options(picks: &[&[usize]]) -> Vec<Pick> {
        picks.iter().map(|p| Pick::Options(p.to_vec())).collect()
    }

    fn output(reply: &str, event: &Value) -> Value {
        serde_json::from_str(&claude_output(reply, event, "claude").unwrap()).unwrap()
    }

    #[test]
    fn answers_as_claude_code_reads_them() {
        let bash = json!({ "tool_input": { "command": "git push" } });
        let allow = output(&answer(Decision::Allow, None).unwrap(), &bash);
        assert_eq!(
            allow["hookSpecificOutput"]["hookEventName"],
            "PermissionRequest"
        );
        assert_eq!(
            allow["hookSpecificOutput"]["decision"],
            json!({ "behavior": "allow" })
        );
        let deny = output(&answer(Decision::Deny, None).unwrap(), &bash);
        assert_eq!(deny["hookSpecificOutput"]["decision"]["behavior"], "deny");
        assert_eq!(answer(Decision::Terminal, None), None);
    }

    #[test]
    fn always_adds_the_agents_own_rules() {
        let rules = json!([{ "type": "addRules", "rules": [{ "toolName": "Bash", "ruleContent": "npm test" }], "behavior": "allow", "destination": "localSettings" }]);
        let event =
            json!({ "tool_input": { "command": "npm test" }, "permission_suggestions": rules });
        let reply = reply_json(&Answer {
            decision: Decision::Allow,
            picked: None,
            always: true,
        })
        .unwrap();
        let out = output(&reply, &event);
        assert_eq!(
            out["hookSpecificOutput"]["decision"]["updatedPermissions"],
            rules
        );
        // Codex takes a plain allow: nothing more.
        let codex: Value =
            serde_json::from_str(&claude_output(&reply, &event, "codex").unwrap()).unwrap();
        assert_eq!(
            codex["hookSpecificOutput"]["decision"],
            json!({ "behavior": "allow" })
        );
    }

    #[test]
    fn answers_a_question_in_its_own_words() {
        let input = json!({ "questions": [
            { "question": "Which target?", "header": "Deploy", "multiSelect": false,
              "options": [{ "label": "Production" }, { "label": "Staging" }] },
            { "question": "Which checks?", "multiSelect": true,
              "options": [{ "label": "Tests" }, { "label": "Lint" }, { "label": "Types" }] }
        ] });
        let event = json!({ "tool_input": input });
        let reply = answer(Decision::Allow, Some(options(&[&[1], &[0, 2]]))).unwrap();
        let out = output(&reply, &event);
        let decision = &out["hookSpecificOutput"]["decision"];
        assert_eq!(decision["behavior"], "allow");
        assert_eq!(
            decision["updatedInput"]["answers"],
            json!({ "Which target?": "Staging", "Which checks?": ["Tests", "Types"] })
        );
        assert_eq!(decision["updatedInput"]["questions"], input["questions"]);
        // A typed answer goes as it is.
        let typed = answer(
            Decision::Allow,
            Some(vec![
                Pick::Text("Both, staging first".into()),
                Pick::Options(vec![0]),
            ]),
        )
        .unwrap();
        assert_eq!(
            output(&typed, &event)["hookSpecificOutput"]["decision"]["updatedInput"]["answers"]["Which target?"],
            "Both, staging first"
        );
        // An option that does not exist answers nothing.
        assert_eq!(
            claude_output(
                &answer(Decision::Allow, Some(options(&[&[5], &[0]]))).unwrap(),
                &event,
                "claude"
            ),
            None
        );
        // Declining a question says so.
        let no = output(&answer(Decision::Deny, None).unwrap(), &event);
        assert!(
            no["hookSpecificOutput"]["decision"]["message"]
                .as_str()
                .unwrap()
                .contains("not to answer")
        );

        let questions = questions_of(Some(&input)).unwrap();
        assert_eq!(questions[0].options.len(), 2);
        assert!(questions[1].multi_select);
        assert!(valid_picks(&questions, &options(&[&[1], &[0, 2]])));
        assert!(valid_picks(
            &questions,
            &[Pick::Text("x".into()), Pick::Options(vec![1])]
        ));
        assert!(!valid_picks(
            &questions,
            &[Pick::Text("  ".into()), Pick::Options(vec![1])]
        ));
        assert!(!valid_picks(&questions, &options(&[&[0, 1], &[0]])));
        assert!(!valid_picks(&questions, &options(&[&[1], &[]])));
        assert!(!valid_picks(&questions, &options(&[&[1]])));
    }

    #[test]
    fn knows_a_dangerous_command() {
        for command in [
            "rm -rf build",
            "rm -r -f node_modules",
            "git push --force origin main",
            "git push -f",
            "git push origin +main",
            "git reset --hard HEAD~3",
            "git clean -fd",
            "git branch -D feature",
            "psql -c 'DROP TABLE users'",
            "Remove-Item -Recurse -Force C:\\data",
            "rd /s /q build",
            "curl -s https://x.sh | sh",
            "sudo apt remove x",
            "format D:",
        ] {
            assert!(dangerous(command), "{command}");
        }
        for command in [
            "rm notes.txt",
            "git push origin main",
            "git reset HEAD file",
            "npm test",
            "ls -rf",
            "echo format",
            "git branch -d done",
        ] {
            assert!(!dangerous(command), "{command}");
        }
    }

    #[test]
    fn tells_how_soon_a_limit_is_reached() {
        let minute = 60_000;
        // 10 points in 20 minutes: 40 points left take 80 minutes.
        let samples = [(0, 50.0), (20 * minute, 60.0)];
        assert_eq!(full_in(&samples, 20 * minute, None), Some(80));
        // It resets before then: no warning.
        assert_eq!(full_in(&samples, 20 * minute, Some(30 * 60)), None);
        // Not filling, or measured over too short a time: nothing to say.
        assert_eq!(
            full_in(&[(0, 60.0), (20 * minute, 60.0)], 20 * minute, None),
            None
        );
        assert_eq!(
            full_in(&[(0, 50.0), (2 * minute, 60.0)], 2 * minute, None),
            None
        );
    }

    #[test]
    fn keeps_the_latest_steps_with_what_they_open() {
        let mut list = Vec::new();
        let step = |tool: &str, target: &str, link: Option<&str>| {
            let mut m = message("PreToolUse");
            m.tool = Some(tool.into());
            m.target = Some(target.into());
            m.link = link.map(Into::into);
            m
        };
        apply(&mut list, step("Read", "a.ts", Some("D:/p/a.ts")), 1);
        apply(&mut list, step("Read", "a.ts", Some("D:/p/a.ts")), 2);
        apply(
            &mut list,
            step("WebFetch", "docs.rs", Some("https://docs.rs/x")),
            3,
        );
        let mut failed = message("PostToolUseFailure");
        failed.tool = Some("WebFetch".into());
        apply(&mut list, failed, 4);
        let recent = &list[0].recent;
        assert_eq!(recent.len(), 2);
        assert_eq!(recent[0].link.as_deref(), Some("https://docs.rs/x"));
        assert!(recent[0].failed && !recent[1].failed);
        for i in 0..10 {
            apply(&mut list, step("Bash", &format!("echo {i}"), None), 10 + i);
        }
        assert_eq!(list[0].recent.len(), MAX_ACTIONS);
        assert_eq!(list[0].recent[0].target.as_deref(), Some("echo 9"));
    }

    #[test]
    fn a_step_carries_its_full_link() {
        let read = json!({
            "hook_event_name": "PreToolUse", "session_id": "s", "tool_name": "Read",
            "tool_input": { "file_path": "D:/code/app/src/auth.ts" }
        });
        let m = extract("claude", &read).unwrap();
        assert_eq!(
            (m.target.as_deref(), m.link.as_deref()),
            (Some("auth.ts"), Some("D:/code/app/src/auth.ts"))
        );
        let plan = json!({
            "hook_event_name": "PermissionRequest", "session_id": "s", "tool_name": "ExitPlanMode",
            "tool_input": { "plan": "1. Do this\n2. Then that" }
        });
        assert_eq!(
            extract("claude", &plan).unwrap().detail.as_deref(),
            Some("1. Do this\n2. Then that")
        );
    }

    #[test]
    fn ignores_what_is_not_a_hook_event() {
        assert!(extract("claude", &json!({ "session_id": "s" })).is_none());
        assert!(extract("claude", &json!({ "hook_event_name": "Stop" })).is_none());
    }

    #[test]
    fn follows_a_turn() {
        let mut list = Vec::new();
        let mut start = message("SessionStart");
        start.window = Some(42);
        assert!(apply(&mut list, start, 1));
        assert_eq!(list[0].project, "quiera");
        assert_eq!(list[0].state, State::Ready);
        assert!(list[0].can_focus);

        apply(&mut list, message("UserPromptSubmit"), 10);
        let mut tool = message("PreToolUse");
        tool.tool = Some("Bash".into());
        tool.target = Some("npm test".into());
        apply(&mut list, tool, 20);
        assert_eq!((list[0].state, list[0].since), (State::Working, 10));
        assert_eq!(list[0].target.as_deref(), Some("npm test"));

        let mut ask = message("Notification");
        ask.kind = Some("permission_prompt".into());
        apply(&mut list, ask, 30);
        assert_eq!(list[0].state, State::Waiting);
        apply(&mut list, message("PostToolUse"), 40);
        assert_eq!((list[0].state, list[0].since), (State::Working, 10));

        apply(&mut list, message("Stop"), 50);
        assert_eq!((list[0].state, list[0].since), (State::Done, 50));
        // Repeated news that changes nothing shown is not a change.
        assert!(!apply(&mut list, message("Notification"), 60));
        assert!(apply(&mut list, message("SessionEnd"), 70));
        assert!(list.is_empty());
    }

    #[test]
    fn a_question_stays_a_question() {
        let mut list = Vec::new();
        apply(&mut list, message("UserPromptSubmit"), 0);
        let mut asked = message("PermissionRequest");
        asked.tool = Some("AskUserQuestion".into());
        asked.target = Some("Which target?".into());
        apply(&mut list, asked, 10);
        assert_eq!(list[0].state, State::Question);
        let mut notice = message("Notification");
        notice.kind = Some("permission_prompt".into());
        apply(&mut list, notice, 20);
        assert_eq!(list[0].state, State::Question);
        assert_eq!(list[0].target.as_deref(), Some("Which target?"));
    }

    #[test]
    fn settles_quiet_sessions() {
        let mut list = Vec::new();
        apply(&mut list, message("UserPromptSubmit"), 0);
        let minute = 60_000;
        assert!(!sweep(&mut list, 5 * minute));
        assert!(sweep(&mut list, 11 * minute));
        assert_eq!(list[0].state, State::Ready);
        assert!(sweep(&mut list, 11 * minute + 3 * 60 * minute + 1));
        assert!(list.is_empty());
    }

    #[test]
    fn hooks_in_and_out_leaving_the_rest() {
        let original = json!({
            "model": "opus",
            "hooks": { "Stop": [{ "hooks": [{ "type": "command", "command": "say done" }] }] },
            "permissions": { "allow": ["Bash(git status)"] }
        });
        let mut config = original.clone();
        hook(&mut config, r"C:\Quiera\Quiera.exe");
        assert_eq!(hooked(&config, r"C:\Quiera\Quiera.exe"), Hooked::Yes);
        assert_eq!(hooked(&config, r"D:\Other\Quiera.exe"), Hooked::Elsewhere);
        assert_eq!(config["hooks"]["Stop"].as_array().unwrap().len(), 2);
        assert_eq!(config["hooks"]["PreToolUse"][0]["matcher"], "*");
        assert_eq!(
            config["hooks"]["SessionEnd"][0]["hooks"][0].get("async"),
            None
        );
        let asks = &config["hooks"]["PermissionRequest"][0]["hooks"][0];
        assert_eq!((asks.get("async"), &asks["timeout"]), (None, &json!(3600)));
        // Twice is the same as once.
        let once = config.clone();
        hook(&mut config, r"C:\Quiera\Quiera.exe");
        assert_eq!(config, once);
        assert!(!outdated(&config, r"C:\Quiera\Quiera.exe"));
        assert!(outdated(&config, r"D:\Moved\Quiera.exe"));

        unhook(&mut config);
        assert_eq!(config, original);
        assert_eq!(hooked(&config, r"C:\Quiera\Quiera.exe"), Hooked::No);
        // The keys keep their order.
        let keys: Vec<&String> = config.as_object().unwrap().keys().collect();
        assert_eq!(keys, ["model", "hooks", "permissions"]);
    }

    #[test]
    fn an_older_hook_set_is_outdated() {
        let mut config = json!({});
        hook(&mut config, "q.exe");
        config["hooks"]
            .as_object_mut()
            .unwrap()
            .shift_remove("PermissionRequest");
        assert_eq!(hooked(&config, "q.exe"), Hooked::Yes);
        assert!(outdated(&config, "q.exe"));
    }

    #[test]
    fn writes_the_file_keeping_a_copy_of_the_original() {
        let dir = std::env::temp_dir().join(format!("quiera-agents-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("settings.json");
        std::fs::write(
            &path,
            "{
  \"model\": \"opus\"
}
",
        )
        .unwrap();

        set_claude(&path, "q.exe", true).unwrap();
        let on: Value = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(hooked(&on, "q.exe"), Hooked::Yes);
        assert_eq!(on["model"], "opus");
        let backup = std::fs::read_to_string(path.with_extension("json.quiera-backup")).unwrap();
        assert!(backup.contains("opus") && !backup.contains("hooks"));

        set_claude(&path, "q.exe", false).unwrap();
        let off: Value = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(off, json!({ "model": "opus" }));
        assert!(!path.with_extension("json.quiera-tmp").exists());

        // Unreadable settings are left alone.
        std::fs::write(&path, "{ not json").unwrap();
        assert!(set_claude(&path, "q.exe", true).is_err());
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "{ not json");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn shows_what_a_change_does() {
        let diff = diff_lines(
            "fn a() {\n    old();\n}\n",
            "fn a() {\n    new();\n    more();\n}\n",
        );
        let shown: Vec<(&str, &str)> = diff
            .iter()
            .map(|l| (l.kind.as_str(), l.text.as_str()))
            .collect();
        assert_eq!(
            shown,
            [
                (" ", "fn a() {"),
                ("-", "    old();"),
                ("+", "    new();"),
                ("+", "    more();"),
                (" ", "}")
            ]
        );
        let edit = json!({
            "hook_event_name": "PermissionRequest", "session_id": "s", "tool_name": "Write",
            "tool_input": { "file_path": "a.txt", "content": "x\n".repeat(100) }
        });
        let m = extract("claude", &edit).unwrap();
        assert_eq!(m.diff.as_ref().unwrap().len(), MAX_DIFF_LINES);
        assert_eq!(m.diff.unwrap().last().unwrap().text, "…");
    }

    #[test]
    fn reads_each_ais_limits() {
        let claude = json!({ "rate_limits": {
            "five_hour": { "used_percentage": 23.5, "resets_at": 1_900_000_000u64 },
            "seven_day": { "used_percentage": 41, "resets_at": 1_900_000_000u64 }
        } });
        let windows = claude_usage(&claude);
        assert_eq!(
            windows
                .iter()
                .map(|w| (w.minutes, w.used))
                .collect::<Vec<_>>(),
            [(300, 23.5), (10080, 41.0)]
        );
        assert!(claude_usage(&json!({ "model": {} })).is_empty());
        let codex = json!({ "primary": { "used_percent": 7.0, "window_minutes": 43200, "resets_at": 1_796_671_956u64 }, "secondary": null });
        assert_eq!(
            codex_usage(&codex),
            [UsageWindow {
                minutes: 43200,
                used: 7.0,
                resets_at: Some(1_796_671_956),
                full_in: None,
            }]
        );
    }

    #[test]
    fn sets_a_status_line_only_where_there_is_none() {
        let mut config = json!({});
        hook(&mut config, "C:/Quiera/quiera.exe");
        assert_eq!(
            config["statusLine"]["command"],
            "C:/Quiera/quiera.exe --agent-status claude"
        );
        assert!(!outdated(&config, "C:/Quiera/quiera.exe"));
        unhook(&mut config);
        assert_eq!(config, json!({}));

        let theirs = json!({ "statusLine": { "type": "command", "command": "my-line.sh" } });
        let mut config = theirs.clone();
        hook(&mut config, "C:/Quiera/quiera.exe");
        assert_eq!(config["statusLine"], theirs["statusLine"]);
        unhook(&mut config);
        assert_eq!(config, theirs);
    }

    #[test]
    fn unhooking_leaves_no_empty_hooks() {
        let mut config = json!({ "theme": "dark" });
        hook(&mut config, "q.exe");
        unhook(&mut config);
        assert_eq!(config, json!({ "theme": "dark" }));
    }
}
