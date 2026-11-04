//! A plugin's `fetch`: HTTPS only, to the hosts its manifest names, with no
//! redirect (one could lead elsewhere), a timeout and a size limit.

use std::io::Read;
use std::time::Duration;

use serde::{Deserialize, Serialize};

const TIMEOUT: Duration = Duration::from_secs(10);
/// Larger answers are cut off with an error.
const MAX_BODY: u64 = 1 << 20;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    pub url: String,
    #[serde(default)]
    pub method: Option<String>,
    #[serde(default)]
    pub headers: Vec<(String, String)>,
    #[serde(default)]
    pub body: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Response {
    pub status: u16,
    pub body: String,
}

/// The host of an `https://` URL, lowercase; None for anything else.
fn https_host(url: &str) -> Option<String> {
    let rest = url.strip_prefix("https://")?;
    let authority = rest.split(['/', '?', '#']).next()?;
    // No credentials in the URL, and the default port only.
    if authority.contains('@') {
        return None;
    }
    let host = authority.strip_suffix(":443").unwrap_or(authority);
    if host.is_empty() || host.contains(':') {
        return None;
    }
    Some(host.to_ascii_lowercase())
}

/// Whether `url` goes to one of `allowed` (or a subdomain of one).
pub fn allowed(url: &str, allowed: &[String]) -> bool {
    let Some(host) = https_host(url) else {
        return false;
    };
    allowed
        .iter()
        .any(|a| host == *a || host.ends_with(&format!(".{a}")))
}

pub fn fetch(request: Request, hosts: &[String]) -> Result<Response, String> {
    if !allowed(&request.url, hosts) {
        return Err(format!(
            "{} is not in this plugin's network permissions",
            https_host(&request.url).unwrap_or_else(|| "this address".into())
        ));
    }
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(TIMEOUT))
        .max_redirects(0)
        .http_status_as_error(false)
        .user_agent(concat!("Quiera/", env!("CARGO_PKG_VERSION"), " plugin"))
        .build()
        .into();
    let method = request
        .method
        .as_deref()
        .unwrap_or("GET")
        .to_ascii_uppercase();
    let mut builder = ureq::http::Request::builder()
        .method(method.as_str())
        .uri(&request.url);
    for (name, value) in &request.headers {
        if !name.eq_ignore_ascii_case("host") {
            builder = builder.header(name, value);
        }
    }
    let http = builder
        .body(request.body.unwrap_or_default())
        .map_err(|e| e.to_string())?;
    let mut response = agent.run(http).map_err(|e| e.to_string())?;
    let status = response.status().as_u16();
    let mut body = String::new();
    response
        .body_mut()
        .as_reader()
        .take(MAX_BODY + 1)
        .read_to_string(&mut body)
        .map_err(|e| e.to_string())?;
    if body.len() as u64 > MAX_BODY {
        return Err("the answer is larger than 1 MB".into());
    }
    Ok(Response { status, body })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hosts() -> Vec<String> {
        vec!["api.open-meteo.com".into()]
    }

    #[test]
    fn lets_through_the_declared_hosts_only() {
        assert!(allowed(
            "https://api.open-meteo.com/v1/forecast?x=1",
            &hosts()
        ));
        assert!(allowed("https://API.open-meteo.com", &hosts()));
        assert!(allowed("https://eu.api.open-meteo.com/x", &hosts()));
        assert!(allowed("https://api.open-meteo.com:443/x", &hosts()));
    }

    #[test]
    fn refuses_everything_else() {
        for url in [
            "http://api.open-meteo.com/v1",
            "https://open-meteo.com/",
            "https://api.open-meteo.com.evil.com/",
            "https://evilapi.open-meteo.com/",
            "https://user@api.open-meteo.com/",
            "https://api.open-meteo.com:8080/",
            "https://evil.com/?https://api.open-meteo.com",
            "file:///C:/Windows/win.ini",
            "https://localhost/",
        ] {
            assert!(!allowed(url, &hosts()), "allowed {url}");
        }
    }
}
