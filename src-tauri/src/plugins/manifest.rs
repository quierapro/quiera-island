//! A plugin's `quiera-plugin.json`: who it is, what it may do, and its tab.
//! Read strictly: a field out of range refuses the plugin rather than
//! guessing, so what people consent to is exactly what it declared.

use serde::{Deserialize, Serialize};

use super::protocol::API;

pub const FILE: &str = "quiera-plugin.json";

/// The tab's size bounds, in CSS pixels (the island's own limits).
const WIDTH: (u32, u32) = (300, 650);
const HEIGHT: (u32, u32) = (80, 260);

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Manifest {
    /// The protocol version it was written for (`protocol::API`).
    #[serde(default = "default_api")]
    pub api: u32,
    /// What runs it.
    #[serde(default)]
    pub runtime: RuntimeKind,
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub description: String,
    /// One emoji: the plugin's face in the tab bar and the settings.
    #[serde(default = "default_icon")]
    pub icon: String,
    #[serde(default = "default_main")]
    pub main: String,
    #[serde(default)]
    pub permissions: Permissions,
    #[serde(default)]
    pub tab: Option<TabSpec>,
}

/// What runs a plugin; all speak the same protocol.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RuntimeKind {
    /// JavaScript, in its own engine: isolated.
    #[default]
    Js,
    /// WebAssembly (Rust, C, Go…): isolated. Not yet.
    Wasm,
    /// A program of its own: full access to the computer. Not yet.
    Native,
}

impl RuntimeKind {
    pub fn name(self) -> &'static str {
        match self {
            RuntimeKind::Js => "js",
            RuntimeKind::Wasm => "wasm",
            RuntimeKind::Native => "native",
        }
    }

    /// The extension of its entry file.
    fn extension(self) -> &'static str {
        match self {
            RuntimeKind::Js => ".js",
            RuntimeKind::Wasm => ".wasm",
            RuntimeKind::Native => ".exe",
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Permissions {
    /// The only hosts it may reach, over HTTPS (subdomains included).
    #[serde(default)]
    pub network: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TabWhen {
    /// In the bar even empty.
    Always,
    /// Once the plugin renders something in it.
    Content,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TabSpec {
    #[serde(default = "default_when")]
    pub when: TabWhen,
    /// Width and height of its panel.
    #[serde(default = "default_size")]
    pub size: [u32; 2],
}

fn default_icon() -> String {
    "🧩".into()
}

fn default_api() -> u32 {
    API
}

fn default_main() -> String {
    "main.js".into()
}

fn default_when() -> TabWhen {
    TabWhen::Content
}

fn default_size() -> [u32; 2] {
    [360, 140]
}

/// "weather", "github-notifications": lowercase letters, digits and dashes.
fn valid_id(id: &str) -> bool {
    (2..=40).contains(&id.len())
        && id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
        && !id.starts_with('-')
        && !id.ends_with('-')
}

/// A host name, without scheme, port or path: "api.open-meteo.com".
fn valid_host(host: &str) -> bool {
    host.len() <= 253
        && host.contains('.')
        && host.split('.').all(|label| {
            !label.is_empty()
                && label.len() <= 63
                && label
                    .bytes()
                    .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
        })
}

impl Manifest {
    pub fn parse(json: &str) -> Result<Self, String> {
        let manifest: Manifest = serde_json::from_str(json).map_err(|e| e.to_string())?;
        manifest.check()?;
        Ok(manifest)
    }

    fn check(&self) -> Result<(), String> {
        if self.api == 0 || self.api > API {
            return Err(format!(
                "api {}: this Quiera speaks the plugin protocol {API} (update Quiera?)",
                self.api
            ));
        }
        if !valid_id(&self.id) {
            return Err(format!(
                "id \"{}\": 2 to 40 lowercase letters, digits or dashes",
                self.id
            ));
        }
        if self.name.trim().is_empty() || self.name.chars().count() > 40 {
            return Err("name: 1 to 40 characters".into());
        }
        if self.version.is_empty() || self.version.len() > 20 {
            return Err("version: 1 to 20 characters".into());
        }
        if self.icon.chars().count() > 4 || self.icon.trim().is_empty() {
            return Err("icon: one emoji".into());
        }
        // The entry file sits in the plugin's folder: no path out of it.
        let extension = self.runtime.extension();
        if !self.main.to_ascii_lowercase().ends_with(extension)
            || self.main.len() <= extension.len()
            || self.main.contains(['/', '\\', ':'])
            || self.main.starts_with('.')
        {
            return Err(format!("main: a {extension} file in the plugin's folder"));
        }
        if let Some(host) = self.permissions.network.iter().find(|h| !valid_host(h)) {
            return Err(format!(
                "permissions.network: \"{host}\" is not a host name (like api.example.com)"
            ));
        }
        if let Some(tab) = self.tab {
            let [w, h] = tab.size;
            if !(WIDTH.0..=WIDTH.1).contains(&w) || !(HEIGHT.0..=HEIGHT.1).contains(&h) {
                return Err(format!(
                    "tab.size: width {}–{}, height {}–{}",
                    WIDTH.0, WIDTH.1, HEIGHT.0, HEIGHT.1
                ));
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_a_minimal_manifest_with_defaults() {
        let m =
            Manifest::parse(r#"{ "id": "weather", "name": "Météo", "version": "1.0.0" }"#).unwrap();
        assert_eq!(m.api, 1);
        assert_eq!(m.runtime, RuntimeKind::Js);
        assert_eq!(m.main, "main.js");
        assert_eq!(m.icon, "🧩");
        assert!(m.permissions.network.is_empty());
        assert_eq!(m.tab, None);
    }

    #[test]
    fn reads_permissions_and_tab() {
        let m = Manifest::parse(
            r#"{ "id": "weather", "name": "Météo", "version": "1", "icon": "☀️",
                 "permissions": { "network": ["api.open-meteo.com"] },
                 "tab": { "when": "always", "size": [380, 120] } }"#,
        )
        .unwrap();
        assert_eq!(m.permissions.network, ["api.open-meteo.com"]);
        assert_eq!(
            m.tab,
            Some(TabSpec {
                when: TabWhen::Always,
                size: [380, 120]
            })
        );
    }

    #[test]
    fn reads_each_runtime_with_its_entry_file() {
        let wasm = Manifest::parse(
            r#"{ "id": "a", "name": "A", "version": "1", "runtime": "wasm", "main": "plugin.wasm" }"#,
        );
        assert!(wasm.is_err(), "id too short");
        let wasm = Manifest::parse(r#"{ "id": "ab", "name": "A", "version": "1", "runtime": "wasm", "main": "plugin.wasm" }"#).unwrap();
        assert_eq!(wasm.runtime, RuntimeKind::Wasm);
        let native = Manifest::parse(r#"{ "id": "ab", "name": "A", "version": "1", "runtime": "native", "main": "battery.exe" }"#).unwrap();
        assert_eq!(native.runtime, RuntimeKind::Native);
    }

    #[test]
    fn refuses_what_it_does_not_know_or_cannot_allow() {
        let bad = [
            r#"{ "id": "Weather", "name": "x", "version": "1" }"#,
            r#"{ "id": "w", "name": "x", "version": "1" }"#,
            r#"{ "id": "weather", "name": "", "version": "1" }"#,
            r#"{ "id": "weather", "name": "x", "version": "1", "main": "../evil.js" }"#,
            r#"{ "id": "weather", "name": "x", "version": "1", "main": "C:\\x.js" }"#,
            r#"{ "id": "weather", "name": "x", "version": "1", "permissions": { "network": ["https://a.com"] } }"#,
            r#"{ "id": "weather", "name": "x", "version": "1", "permissions": { "network": ["*"] } }"#,
            r#"{ "id": "weather", "name": "x", "version": "1", "permissions": { "files": true } }"#,
            r#"{ "id": "weather", "name": "x", "version": "1", "tab": { "size": [2000, 100] } }"#,
            r#"{ "id": "weather", "name": "x", "version": "1", "extra": 1 }"#,
            r#"{ "id": "weather", "name": "x", "version": "1", "api": 2 }"#,
            r#"{ "id": "weather", "name": "x", "version": "1", "runtime": "python" }"#,
            r#"{ "id": "weather", "name": "x", "version": "1", "runtime": "native", "main": "main.js" }"#,
            r#"{ "id": "weather", "name": "x", "version": "1", "main": ".js" }"#,
        ];
        for json in bad {
            assert!(Manifest::parse(json).is_err(), "accepted {json}");
        }
    }
}
