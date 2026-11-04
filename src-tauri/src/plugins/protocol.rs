//! The Quiera plugin protocol, version 1: the messages between Quiera and a
//! plugin, whatever runs it (the JavaScript engine today; a WebAssembly
//! module or a separate program later). Each message is a JSON object with
//! a `type`:
//!
//! - to Quiera: `render` (the tab), `activity` (the closed island), `peek`,
//!   `log`;
//! - to the plugin: `open` and `close` (its tab), `action` (a button or a
//!   toggle in its views).
//!
//! What every plugin must respect whatever runs it (sizes, how often it may
//! peek) is checked by the registry when a message arrives, not by each
//! runtime.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// The protocol version this Quiera speaks; a manifest asks for one.
pub const API: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Level {
    Log,
    Info,
    Warn,
    Error,
}

/// From a plugin to Quiera.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase", deny_unknown_fields)]
pub enum ToQuiera {
    /// The plugin's tab: a tree of Quiera's pieces, or null to empty it.
    Render { tree: Option<Value> },
    /// The closed island while it has something live, or null to leave it.
    Activity { activity: Option<Value> },
    /// A moment on the island: `{ icon, title, text }`.
    Peek { peek: Value },
    /// A line for its console, in the settings.
    Log { level: Level, text: String },
}

/// From Quiera to a plugin.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ToPlugin {
    /// Its tab was opened: a good moment to refresh.
    Open,
    /// Its tab was left.
    Close,
    /// A button, toggle or list item with this `action` was used; a toggle
    /// sends its new value.
    Action {
        action: String,
        #[serde(default)]
        value: Option<Value>,
    },
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn messages_read_and_write_as_documented() {
        let render: ToQuiera = serde_json::from_value(
            json!({ "type": "render", "tree": { "type": "text", "text": "14°" } }),
        )
        .unwrap();
        assert_eq!(
            render,
            ToQuiera::Render {
                tree: Some(json!({ "type": "text", "text": "14°" }))
            }
        );
        let clear: ToQuiera =
            serde_json::from_value(json!({ "type": "activity", "activity": null })).unwrap();
        assert_eq!(clear, ToQuiera::Activity { activity: None });
        let log: ToQuiera =
            serde_json::from_value(json!({ "type": "log", "level": "warn", "text": "x" })).unwrap();
        assert_eq!(
            log,
            ToQuiera::Log {
                level: Level::Warn,
                text: "x".into()
            }
        );

        let action = ToPlugin::Action {
            action: "refresh".into(),
            value: Some(json!(true)),
        };
        assert_eq!(
            serde_json::to_value(&action).unwrap(),
            json!({ "type": "action", "action": "refresh", "value": true })
        );
        assert_eq!(
            serde_json::to_value(ToPlugin::Open).unwrap(),
            json!({ "type": "open" })
        );
    }

    #[test]
    fn refuses_what_is_not_in_the_protocol() {
        for bad in [
            json!({ "type": "exec", "command": "calc.exe" }),
            json!({ "type": "peek" }),
            json!({ "type": "log", "level": "debug", "text": "x" }),
            json!({ "type": "peek", "peek": {}, "extra": 1 }),
        ] {
            assert!(
                serde_json::from_value::<ToQuiera>(bad.clone()).is_err(),
                "accepted {bad}"
            );
        }
    }
}
