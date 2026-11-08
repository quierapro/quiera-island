//! Answering an agent from the phone: a page on the local network, reached
//! by a QR code, that lists the permissions waiting and allows or denies
//! them. Off until the user shows the code; the link works for a few hours,
//! only with its random token, and only on the same Wi-Fi.
//!
//! What a phone cannot do: allow a risky command (rm -rf, a forced push…),
//! answer a question or approve a plan. Those stay on the PC.

use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::json;

use crate::agents::{self, Decision};
use crate::share::{self, PhoneLink};

/// How long a phone stays linked.
const LIFETIME: Duration = Duration::from_secs(8 * 60 * 60);

struct Link {
    token: String,
    until: Instant,
}

static LINK: LazyLock<Mutex<Option<Link>>> = LazyLock::new(Mutex::default);

fn link() -> std::sync::MutexGuard<'static, Option<Link>> {
    LINK.lock().unwrap_or_else(|e| e.into_inner())
}

/// Links a phone: a new address (the old one stops working), as a QR code.
#[tauri::command]
pub fn agents_phone_start() -> Result<PhoneLink, String> {
    let (ip, port) = share::server_address()?;
    let token = share::new_token().map_err(|e| e.to_string())?;
    let url = format!("http://{ip}:{port}/a/{token}");
    let (qr_size, qr_path) = share::qr_code(&url)?;
    *link() = Some(Link {
        token: token.clone(),
        until: Instant::now() + LIFETIME,
    });
    log::info!("agents: a phone link was made");
    Ok(PhoneLink {
        token,
        url,
        qr_size,
        qr_path,
        expires_in_secs: LIFETIME.as_secs(),
    })
}

/// Unlinks the phone: its address stops working at once.
#[tauri::command]
pub fn agents_phone_stop() {
    *link() = None;
}

/// A permission as the phone shows it. Mirrors the page's script below.
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PhoneRequest {
    pub id: u64,
    pub agent: String,
    pub project: String,
    pub tool: Option<String>,
    /// The command, the address, or the file.
    pub what: Option<String>,
    /// "allow" (the phone may answer), "pc" (risky, a question, a plan: on the PC).
    pub answer: &'static str,
}

/// The permissions waiting now, as the phone shows them.
pub fn waiting() -> Vec<PhoneRequest> {
    agents::agents_sessions()
        .into_iter()
        .filter_map(|s| {
            let r = s.request?;
            let on_pc =
                r.danger || r.questions.is_some() || r.tool.as_deref() == Some("ExitPlanMode");
            Some(PhoneRequest {
                id: r.id,
                agent: s.agent,
                project: s.project,
                tool: r.tool,
                what: r.detail.or(r.target),
                answer: if on_pc { "pc" } else { "allow" },
            })
        })
        .collect()
}

/// What the phone may do with a request: deny anything waiting; allow only
/// what is neither risky, nor a question, nor a plan.
pub fn may_decide(id: u64, decision: Decision) -> bool {
    waiting()
        .iter()
        .any(|r| r.id == id && (decision == Decision::Deny || r.answer == "allow"))
}

/// The answer to a request under `/a/`: its status, type and body. None
/// when the token is not the linked phone's (or it has expired).
pub fn route(
    method: &str,
    target: &str,
    french: bool,
) -> Option<(&'static str, &'static str, String)> {
    let path = target.split('?').next().unwrap_or("");
    let mut parts = path.trim_matches('/').split('/');
    if parts.next() != Some("a") {
        return None;
    }
    let token = parts.next()?;
    {
        let mut linked = link();
        match linked.as_ref() {
            Some(l) if l.until <= Instant::now() => {
                *linked = None;
                return None;
            }
            Some(l) if share::same_token(&l.token, token) => {}
            _ => return None,
        }
    }
    let json = "application/json; charset=utf-8";
    Some(match (method, parts.next(), parts.next(), parts.next()) {
        ("GET", None, _, _) => ("200 OK", "text/html; charset=utf-8", page(french)),
        ("GET", Some("state"), None, _) => {
            ("200 OK", json, json!({ "waiting": waiting() }).to_string())
        }
        ("POST", Some(choice @ ("allow" | "deny")), Some(id), None) => {
            let decision = if choice == "allow" {
                Decision::Allow
            } else {
                Decision::Deny
            };
            let ok = id
                .parse::<u64>()
                .ok()
                .filter(|&id| may_decide(id, decision))
                .is_some_and(|id| agents::agents_decide(id, decision, None, None));
            if ok {
                log::info!("agents: a permission was answered from the phone");
            }
            ("200 OK", json, json!({ "ok": ok }).to_string())
        }
        _ => ("404 Not Found", json, json!({ "ok": false }).to_string()),
    })
}

/// The phone's page: the requests waiting, refreshed every two seconds;
/// the phone vibrates when one arrives (where the browser lets it).
fn page(french: bool) -> String {
    let t = |fr: &'static str, en: &'static str| if french { fr } else { en };
    format!(
        r#"<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Quiera</title><style>{style}</style></head><body><main><h1>{title}</h1><p class="hint">{hint}</p><div id="list"></div><p id="empty" class="empty">{empty}</p><footer>{footer}</footer></main><script>
const T={{allow:{allow},deny:{deny},pc:{pc},gone:{gone}}};
let known=new Set();
function el(tag,cls,text){{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}}
async function decide(id,choice,card){{card.classList.add("busy");try{{await fetch(location.pathname.replace(/\/$/,"")+"/"+choice+"/"+id,{{method:"POST"}})}}catch(e){{}}refresh()}}
async function refresh(){{let data;try{{const r=await fetch(location.pathname.replace(/\/$/,"")+"/state",{{cache:"no-store"}});if(!r.ok){{document.getElementById("empty").textContent=T.gone;document.getElementById("list").replaceChildren();return}}data=await r.json()}}catch(e){{return}}
const list=document.getElementById("list");list.replaceChildren();let fresh=false;
for(const w of data.waiting){{if(!known.has(w.id)){{fresh=true;known.add(w.id)}}const card=el("div","card");card.append(el("div","who",(w.agent==="claude"?"Claude":w.agent==="codex"?"Codex":w.agent)+" · "+w.project));card.append(el("div","tool",w.tool||""));if(w.what)card.append(el("code","what",w.what));const row=el("div","row");const no=el("button","no",T.deny);no.onclick=()=>decide(w.id,"deny",card);row.append(no);if(w.answer==="allow"){{const yes=el("button","yes",T.allow);yes.onclick=()=>decide(w.id,"allow",card);row.append(yes)}}else row.append(el("span","pc",T.pc));card.append(row);list.append(card)}}
document.getElementById("empty").style.display=data.waiting.length?"none":"block";
if(fresh&&navigator.vibrate)navigator.vibrate([120,60,120]);}}
refresh();setInterval(refresh,2000);
</script></body></html>"#,
        lang = if french { "fr" } else { "en" },
        style = STYLE,
        title = t("Tes agents IA", "Your AI agents"),
        hint = t(
            "Garde cette page ouverte : les demandes de Claude apparaissent ici en direct.",
            "Keep this page open: Claude's requests show up here live."
        ),
        empty = t("Rien en attente.", "Nothing waiting."),
        footer = t(
            "Quiera · sur ton Wi-Fi seulement. Les commandes risquées, les questions et les plans se valident sur le PC.",
            "Quiera · on your Wi-Fi only. Risky commands, questions and plans are answered on the PC."
        ),
        allow = json!(t("Autoriser", "Allow")),
        deny = json!(t("Refuser", "Deny")),
        pc = json!(t("À valider sur le PC", "Answer on the PC")),
        gone = json!(t(
            "Ce lien ne marche plus : refais le QR code dans Quiera.",
            "This link no longer works: make a new QR code in Quiera."
        )),
    )
}

const STYLE: &str = "body{margin:0;background:#111;color:#fff;font:16px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif}main{max-width:520px;margin:0 auto;padding:24px 16px 40px}h1{font-size:22px;margin:0 0 4px}.hint{color:#9a9aa1;margin:0 0 18px;font-size:14px}.card{padding:14px;margin-bottom:12px;border-radius:18px;background:#1d1d20}.card.busy{opacity:.5}.who{font-weight:700}.tool{color:#ff9f0a;font-size:13px;font-weight:600;margin:2px 0 8px}.what{display:block;padding:8px 10px;border-radius:10px;background:#2a2a2e;font:13px ui-monospace,Consolas,monospace;overflow-wrap:anywhere;margin-bottom:12px}.row{display:flex;gap:10px;align-items:center}button{flex:1;height:44px;border:0;border-radius:22px;font:600 15px system-ui,sans-serif}.no{background:#2e2e33;color:#fff}.yes{background:#fff;color:#000}.pc{flex:1;text-align:center;color:#ff453a;font-size:13px;font-weight:600}.empty{color:#6b6b73;text-align:center;margin:40px 0}footer{margin-top:24px;color:#6b6b73;font-size:12px}";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn answers_only_the_linked_phone() {
        *link() = Some(Link {
            token: "a".repeat(32),
            until: Instant::now() + LIFETIME,
        });
        let good = format!("/a/{}", "a".repeat(32));
        assert_eq!(route("GET", &good, true).unwrap().0, "200 OK");
        assert!(route("GET", "/a/wrong", true).is_none());
        assert!(route("GET", "/s/whatever", true).is_none());
        assert_eq!(
            route("GET", &format!("{good}/state"), false).unwrap().1,
            "application/json; charset=utf-8"
        );
        // Nothing waits: nothing to allow.
        assert!(
            route("POST", &format!("{good}/allow/7"), false)
                .unwrap()
                .2
                .contains("false")
        );
        agents_phone_stop();
        assert!(route("GET", &good, true).is_none());
    }
}
