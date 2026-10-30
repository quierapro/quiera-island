//! Sending Shelf files to a phone. Quiera serves them on the local network at
//! an unguessable link shown as a QR code: the phone's camera opens it and the
//! files download, on iPhone and Android alike, with no app. A link lasts ten
//! minutes, and nothing goes through the Internet. The other way is Windows'
//! own Share panel (Phone Link, Quick Share, Nearby sharing).

use std::collections::HashMap;
use std::fmt::Write as _;
use std::fs::File;
use std::io::{self, BufRead, BufReader, Read, Write};
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpListener, TcpStream, UdpSocket};
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex, OnceLock};
use std::time::{Duration, Instant};

use qrcode::{Color, EcLevel, QrCode};
use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::platform;

/// How long a link works.
pub const LIFETIME: Duration = Duration::from_secs(10 * 60);
/// Longest request line or header line read.
const MAX_LINE: u64 = 8 * 1024;

struct Offer {
    files: Vec<PathBuf>,
    until: Instant,
}

static OFFERS: LazyLock<Mutex<HashMap<String, Offer>>> = LazyLock::new(Default::default);
/// The server's port, once started (on first use, so Windows' firewall asks
/// about it when the user is sharing, not at startup).
static PORT: OnceLock<u16> = OnceLock::new();

fn offers() -> std::sync::MutexGuard<'static, HashMap<String, Offer>> {
    OFFERS.lock().unwrap_or_else(|e| e.into_inner())
}

/// Mirrors `PhoneLink` in `src/ipc/shelf.ts`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhoneLink {
    /// Ends the link early (`shelf_share_stop`).
    pub token: String,
    pub url: String,
    /// Modules per side of the QR code, without its margin.
    pub qr_size: usize,
    /// SVG path of the dark modules, one unit per module.
    pub qr_path: String,
    pub expires_in_secs: u64,
}

/// A link to the Shelf files `ids` (folders are left out), as a QR code.
#[tauri::command]
pub fn shelf_share_phone(ids: Vec<u32>) -> Result<PhoneLink, String> {
    let files = crate::shelf::file_paths(&ids);
    if files.is_empty() {
        return Err("Aucun fichier à envoyer (les dossiers ne s'envoient pas).".into());
    }
    let ip = local_ip().ok_or("Pas de réseau local : connecte le PC au Wi-Fi ou à une box.")?;
    let port = server_port().map_err(|e| format!("Le partage n'a pas pu démarrer : {e}"))?;
    let token = new_token().map_err(|e| e.to_string())?;
    let url = format!("http://{ip}:{port}/s/{token}");
    let (qr_size, qr_path) = qr_code(&url)?;
    let now = Instant::now();
    let mut offers = offers();
    offers.retain(|_, o| o.until > now);
    offers.insert(
        token.clone(),
        Offer {
            files,
            until: now + LIFETIME,
        },
    );
    Ok(PhoneLink {
        token,
        url,
        qr_size,
        qr_path,
        expires_in_secs: LIFETIME.as_secs(),
    })
}

/// Ends a link before its time: the code left the screen (back, files
/// changed), and its files are no longer served.
#[tauri::command]
pub fn shelf_share_stop(token: String) {
    offers().remove(&token);
}

/// Opens Windows' Share panel with the Shelf files `ids`.
#[tauri::command]
pub fn shelf_share_windows(app: AppHandle, ids: Vec<u32>) -> Result<(), String> {
    let files = crate::shelf::file_paths(&ids);
    if files.is_empty() {
        return Err("Aucun fichier à partager.".into());
    }
    let window = app
        .get_webview_window(crate::island::LABEL)
        .ok_or("no island window")?;
    platform::share_files(&window, &files)
}

/// The address other devices on the network reach this PC at.
fn local_ip() -> Option<IpAddr> {
    pick_ip(route_ip(), &platform::lan_addresses())
}

/// The source address of the default route. Connecting a UDP socket sends
/// nothing: it only asks the system which route it would take.
fn route_ip() -> Option<IpAddr> {
    let socket = UdpSocket::bind((Ipv4Addr::UNSPECIFIED, 0)).ok()?;
    socket.connect((Ipv4Addr::new(192, 0, 2, 1), 9)).ok()?;
    let ip = socket.local_addr().ok()?.ip();
    (!ip.is_loopback() && !ip.is_unspecified()).then_some(ip)
}

/// The default route's address when it is a Wi-Fi or Ethernet one; with a
/// VPN holding the route, that adapter's address would not reach the phone,
/// so the first Wi-Fi or Ethernet address instead. Without that list (other
/// systems), the route's.
pub fn pick_ip(route: Option<IpAddr>, lan: &[Ipv4Addr]) -> Option<IpAddr> {
    match route {
        Some(IpAddr::V4(ip)) if lan.contains(&ip) => route,
        _ => lan.first().map(|ip| IpAddr::V4(*ip)).or(route),
    }
}

fn new_token() -> Result<String, getrandom::Error> {
    let mut bytes = [0u8; 16];
    getrandom::fill(&mut bytes)?;
    Ok(bytes.iter().fold(String::with_capacity(32), |mut s, b| {
        let _ = write!(s, "{b:02x}");
        s
    }))
}

fn server_port() -> io::Result<u16> {
    if let Some(port) = PORT.get() {
        return Ok(*port);
    }
    let port = serve(TcpListener::bind(SocketAddr::from((
        Ipv4Addr::UNSPECIFIED,
        0,
    )))?)?;
    Ok(*PORT.get_or_init(|| port))
}

/// Answers on `listener`, one thread per connection. Returns its port.
fn serve(listener: TcpListener) -> io::Result<u16> {
    let port = listener.local_addr()?.port();
    std::thread::Builder::new()
        .name("quiera-share".into())
        .spawn(move || {
            for stream in listener.incoming().flatten() {
                let _ = std::thread::Builder::new()
                    .name("quiera-share-client".into())
                    .spawn(move || {
                        if let Err(e) = handle(stream) {
                            log::debug!("share request ended: {e}");
                        }
                    });
            }
        })?;
    Ok(port)
}

/// The QR code of `text`: its side in modules, and its dark modules as an SVG path.
pub fn qr_code(text: &str) -> Result<(usize, String), String> {
    let code = QrCode::with_error_correction_level(text, EcLevel::M).map_err(|e| e.to_string())?;
    let width = code.width();
    let mut path = String::new();
    for (i, color) in code.to_colors().iter().enumerate() {
        if *color == Color::Dark {
            let _ = write!(path, "M{} {}h1v1h-1z", i % width, i / width);
        }
    }
    Ok((width, path))
}

/// What a request asks for.
#[derive(Debug, PartialEq)]
pub enum Route {
    /// The page listing an offer's files. The token is the offer's own, never
    /// text from the request, since the page links to it.
    Page {
        token: String,
        files: Vec<PathBuf>,
    },
    /// One file, to download, or to show (images, so a phone can save them to its photos).
    File {
        path: PathBuf,
        inline: bool,
    },
    Expired,
    NotFound,
}

/// `/s/<token>`, `/s/<token>/<n>`, `/s/<token>/<n>/voir`.
pub fn route(target: &str, now: Instant) -> Route {
    let path = target.split('?').next().unwrap_or("");
    let mut parts = path.trim_matches('/').split('/');
    if parts.next() != Some("s") {
        return Route::NotFound;
    }
    let Some(token) = parts.next() else {
        return Route::NotFound;
    };
    let offers = offers();
    let Some((token, offer)) = offers.get_key_value(token) else {
        return Route::Expired;
    };
    if offer.until <= now {
        return Route::Expired;
    }
    let Some(index) = parts.next() else {
        return Route::Page {
            token: token.clone(),
            files: offer.files.clone(),
        };
    };
    let inline = match parts.next() {
        None => false,
        Some("voir") => true,
        Some(_) => return Route::NotFound,
    };
    match index.parse::<usize>().ok().and_then(|i| offer.files.get(i)) {
        Some(path) if parts.next().is_none() => Route::File {
            path: path.clone(),
            inline,
        },
        _ => Route::NotFound,
    }
}

fn read_line(reader: &mut impl BufRead) -> io::Result<String> {
    let mut line = String::new();
    reader.take(MAX_LINE).read_line(&mut line)?;
    Ok(line)
}

fn handle(stream: TcpStream) -> io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(10)))?;
    stream.set_write_timeout(Some(Duration::from_secs(30)))?;
    let mut reader = BufReader::new(stream.try_clone()?);
    let request = read_line(&mut reader)?;
    // The headers are not needed: read through them.
    loop {
        let line = read_line(&mut reader)?;
        if line.trim().is_empty() {
            break;
        }
    }
    let mut words = request.split_whitespace();
    let (method, target) = (words.next().unwrap_or(""), words.next().unwrap_or(""));
    let mut out = stream;
    if method != "GET" && method != "HEAD" {
        return reply(
            &mut out,
            "405 Method Not Allowed",
            "text/plain; charset=utf-8",
            b"",
            method == "HEAD",
        );
    }
    let head = method == "HEAD";
    match route(target, Instant::now()) {
        Route::Page { token, files } => reply(
            &mut out,
            "200 OK",
            "text/html; charset=utf-8",
            page(&token, &files).as_bytes(),
            head,
        ),
        Route::File { path, inline } => send_file(&mut out, &path, inline, head),
        Route::Expired => reply(
            &mut out,
            "410 Gone",
            "text/html; charset=utf-8",
            message_page(
                "Ce lien a expiré",
                "Renvoie le fichier depuis Quiera pour avoir un nouveau code.",
            )
            .as_bytes(),
            head,
        ),
        Route::NotFound => reply(
            &mut out,
            "404 Not Found",
            "text/html; charset=utf-8",
            message_page("Introuvable", "Cette adresse ne mène à rien.").as_bytes(),
            head,
        ),
    }
}

fn reply(
    out: &mut TcpStream,
    status: &str,
    content_type: &str,
    body: &[u8],
    head: bool,
) -> io::Result<()> {
    write!(
        out,
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\nConnection: close\r\n\r\n",
        body.len()
    )?;
    if !head {
        out.write_all(body)?;
    }
    out.flush()
}

fn send_file(out: &mut TcpStream, path: &Path, inline: bool, head: bool) -> io::Result<()> {
    let Ok(mut file) = File::open(path) else {
        let body = message_page("Fichier introuvable", "Il a été déplacé ou supprimé du PC.");
        return reply(
            out,
            "404 Not Found",
            "text/html; charset=utf-8",
            body.as_bytes(),
            head,
        );
    };
    let len = file.metadata()?.len();
    let name = file_name(path);
    let disposition = if inline { "inline" } else { "attachment" };
    write!(
        out,
        "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {len}\r\nContent-Disposition: {disposition}; filename=\"{}\"; filename*=UTF-8''{}\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\nConnection: close\r\n\r\n",
        content_type(path),
        ascii_name(&name),
        percent_encode(&name)
    )?;
    if !head {
        io::copy(&mut file, out)?;
    }
    out.flush()
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "fichier".into())
}

/// The name for clients that ignore `filename*`: ASCII, no quotes.
fn ascii_name(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c == ' ' || (c.is_ascii_graphic() && c != '"' && c != '\\') {
                c
            } else {
                '_'
            }
        })
        .collect()
}

pub fn percent_encode(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for b in text.bytes() {
        if b.is_ascii_alphanumeric() || b"-._~".contains(&b) {
            out.push(b as char);
        } else {
            let _ = write!(out, "%{b:02X}");
        }
    }
    out
}

fn extension(path: &Path) -> String {
    path.extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default()
}

fn content_type(path: &Path) -> &'static str {
    match extension(path).as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "heic" => "image/heic",
        "mp4" => "video/mp4",
        "mov" => "video/quicktime",
        "mp3" => "audio/mpeg",
        "m4a" => "audio/mp4",
        "pdf" => "application/pdf",
        "txt" => "text/plain; charset=utf-8",
        "zip" => "application/zip",
        _ => "application/octet-stream",
    }
}

fn is_image(path: &Path) -> bool {
    matches!(
        extension(path).as_str(),
        "jpg" | "jpeg" | "png" | "gif" | "webp"
    )
}

pub fn escape_html(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(c),
        }
    }
    out
}

/// "2,4 Mo", "812 Ko": as the island writes sizes.
pub fn format_size(bytes: u64) -> String {
    let units = ["o", "Ko", "Mo", "Go", "To"];
    let mut value = bytes as f64;
    let mut unit = 0;
    while value >= 1000.0 && unit < units.len() - 1 {
        value /= 1000.0;
        unit += 1;
    }
    if unit == 0 || value >= 100.0 {
        format!("{} {}", value.round(), units[unit])
    } else {
        format!("{:.1} {}", value, units[unit])
            .replace('.', ",")
            .replace(",0 ", " ")
    }
}

const STYLE: &str = "body{margin:0;background:#111;color:#fff;font:16px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif}main{max-width:520px;margin:0 auto;padding:28px 16px 40px}h1{font-size:22px;margin:0 0 4px}p{color:#9a9aa1;margin:0 0 22px}.file{display:flex;align-items:center;gap:12px;padding:12px;margin-bottom:10px;border-radius:16px;background:#1d1d20}.file img{width:56px;height:56px;object-fit:cover;border-radius:10px;flex:none}.name{flex:1;min-width:0;overflow-wrap:anywhere;font-weight:600}.size{display:block;color:#9a9aa1;font-size:13px;font-weight:500}a.get{flex:none;padding:10px 16px;border-radius:999px;background:#fff;color:#111;font-weight:700;text-decoration:none}footer{margin-top:24px;color:#6b6b73;font-size:13px}";

fn page(token: &str, files: &[PathBuf]) -> String {
    let mut rows = String::new();
    for (i, path) in files.iter().enumerate() {
        let name = escape_html(&file_name(path));
        let size = std::fs::metadata(path)
            .map(|m| format_size(m.len()))
            .unwrap_or_default();
        let preview = if is_image(path) {
            format!(
                "<a href=\"/s/{token}/{i}/voir\"><img src=\"/s/{token}/{i}/voir\" alt=\"\"></a>"
            )
        } else {
            String::new()
        };
        let _ = write!(
            rows,
            "<div class=\"file\">{preview}<span class=\"name\">{name}<span class=\"size\">{size}</span></span><a class=\"get\" href=\"/s/{token}/{i}\">Télécharger</a></div>"
        );
    }
    let count = if files.len() == 1 {
        "1 fichier".to_owned()
    } else {
        format!("{} fichiers", files.len())
    };
    format!(
        "<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex\"><title>Quiera · {count}</title><style>{STYLE}</style></head><body><main><h1>Envoyé depuis Quiera</h1><p>{count} · le lien expire 10 minutes après sa création dans Quiera. Pour garder une photo dans tes photos, touche-la longuement.</p>{rows}<footer>Les fichiers viennent directement du PC, sur ton réseau local.</footer></main></body></html>"
    )
}

fn message_page(title: &str, text: &str) -> String {
    format!(
        "<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex\"><title>Quiera · {title}</title><style>{STYLE}</style></head><body><main><h1>{title}</h1><p>{text}</p></main></body></html>"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn offer(token: &str, files: &[&str], until: Instant) {
        offers().insert(
            token.into(),
            Offer {
                files: files.iter().map(PathBuf::from).collect(),
                until,
            },
        );
    }

    #[test]
    fn routes_an_offer() {
        let now = Instant::now();
        offer("a1", &["C:/x/photo.jpg", "C:/x/doc.pdf"], now + LIFETIME);
        assert_eq!(
            route("/s/a1", now),
            Route::Page {
                token: "a1".into(),
                files: vec!["C:/x/photo.jpg".into(), "C:/x/doc.pdf".into()]
            }
        );
        assert_eq!(route("/s/a1/", now), route("/s/a1", now));
        assert_eq!(
            route("/s/a1/1", now),
            Route::File {
                path: "C:/x/doc.pdf".into(),
                inline: false
            }
        );
        assert_eq!(
            route("/s/a1/0/voir", now),
            Route::File {
                path: "C:/x/photo.jpg".into(),
                inline: true
            }
        );
        assert_eq!(
            route("/s/a1/0?x=1", now),
            Route::File {
                path: "C:/x/photo.jpg".into(),
                inline: false
            }
        );
    }

    #[test]
    fn refuses_what_was_not_offered() {
        let now = Instant::now();
        offer("b2", &["C:/x/one.txt"], now + LIFETIME);
        assert_eq!(route("/s/b2/1", now), Route::NotFound);
        assert_eq!(route("/s/b2/-1", now), Route::NotFound);
        assert_eq!(route("/s/b2/../../Windows/win.ini", now), Route::NotFound);
        assert_eq!(route("/s/b2/0/voir/plus", now), Route::NotFound);
        assert_eq!(route("/s/unknown", now), Route::Expired);
        assert_eq!(route("/", now), Route::NotFound);
        assert_eq!(route("/C:/x/one.txt", now), Route::NotFound);
    }

    #[test]
    fn links_expire() {
        let now = Instant::now();
        offer("c3", &["C:/x/one.txt"], now + Duration::from_secs(1));
        assert!(matches!(route("/s/c3", now), Route::Page { .. }));
        assert_eq!(route("/s/c3", now + Duration::from_secs(2)), Route::Expired);
        assert_eq!(
            route("/s/c3/0", now + Duration::from_secs(2)),
            Route::Expired
        );
    }

    #[test]
    fn picks_an_address_the_phone_can_reach() {
        let wifi = Ipv4Addr::new(192, 168, 1, 20);
        let vpn = IpAddr::V4(Ipv4Addr::new(10, 8, 0, 2));
        // The route goes through the Wi-Fi: it.
        assert_eq!(
            pick_ip(Some(IpAddr::V4(wifi)), &[wifi]),
            Some(IpAddr::V4(wifi))
        );
        // A VPN holds the route: the Wi-Fi's address instead.
        assert_eq!(pick_ip(Some(vpn), &[wifi]), Some(IpAddr::V4(wifi)));
        // No adapter list (other systems): the route's.
        assert_eq!(pick_ip(Some(vpn), &[]), Some(vpn));
        assert_eq!(pick_ip(None, &[]), None);
    }

    #[test]
    fn tokens_are_long_and_different() {
        let a = new_token().unwrap();
        let b = new_token().unwrap();
        assert_eq!(a.len(), 32);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(a, b);
    }

    #[test]
    fn qr_code_is_square_paths() {
        let (size, path) =
            qr_code("http://192.168.1.20:51234/s/0123456789abcdef0123456789abcdef").unwrap();
        assert!(size >= 21 && (size - 21) % 4 == 0);
        assert!(
            path.starts_with("M0 0h1v1h-1z"),
            "finder pattern's corner is dark"
        );
    }

    #[test]
    fn names_are_safe_in_headers_and_html() {
        assert_eq!(percent_encode("été 2026.jpg"), "%C3%A9t%C3%A9%202026.jpg");
        assert_eq!(ascii_name("été \"x\".jpg"), "_t_ _x_.jpg");
        assert_eq!(
            escape_html("<a href='x'>&</a>"),
            "&lt;a href=&#39;x&#39;&gt;&amp;&lt;/a&gt;"
        );
    }

    /// One request to `port`, the whole response back.
    fn get(port: u16, request: &str) -> String {
        let mut stream = TcpStream::connect((Ipv4Addr::LOCALHOST, port)).unwrap();
        stream.write_all(request.as_bytes()).unwrap();
        let mut response = Vec::new();
        stream.read_to_end(&mut response).unwrap();
        String::from_utf8_lossy(&response).into_owned()
    }

    #[test]
    fn serves_the_page_and_the_files() {
        let dir = std::env::temp_dir().join(format!("quiera-share-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("été & co.txt");
        std::fs::write(&file, "bonjour").unwrap();
        offers().insert(
            "d4".into(),
            Offer {
                files: vec![file.clone()],
                until: Instant::now() + LIFETIME,
            },
        );
        // Loopback only: a test must not open a port to the network.
        let port = serve(TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap()).unwrap();

        let page = get(port, "GET /s/d4 HTTP/1.1\r\nHost: pc\r\n\r\n");
        assert!(page.starts_with("HTTP/1.1 200 OK\r\n"), "{page}");
        assert!(page.contains("été &amp; co.txt"), "name escaped: {page}");
        assert!(page.contains("href=\"/s/d4/0\""));

        // A query string never reaches the page's links.
        let tampered = get(port, "GET /s/d4?\"><b>x HTTP/1.1\r\n\r\n");
        assert!(!tampered.contains("<b>x"), "{tampered}");
        assert!(tampered.contains("href=\"/s/d4/0\""));

        let download = get(port, "GET /s/d4/0 HTTP/1.1\r\n\r\n");
        assert!(download.contains("Content-Length: 7\r\n"));
        assert!(download.contains(
            "attachment; filename=\"_t_ & co.txt\"; filename*=UTF-8''%C3%A9t%C3%A9%20%26%20co.txt"
        ));
        assert!(download.ends_with("\r\n\r\nbonjour"));

        let head = get(port, "HEAD /s/d4/0 HTTP/1.1\r\n\r\n");
        assert!(head.ends_with("\r\n\r\n"), "no body: {head}");
        assert!(get(port, "GET /s/zz HTTP/1.1\r\n\r\n").starts_with("HTTP/1.1 410"));
        assert!(get(port, "GET /s/d4/9 HTTP/1.1\r\n\r\n").starts_with("HTTP/1.1 404"));
        assert!(get(port, "POST /s/d4/0 HTTP/1.1\r\n\r\n").starts_with("HTTP/1.1 405"));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn sizes_read_like_the_island() {
        assert_eq!(format_size(512), "512 o");
        assert_eq!(format_size(812_000), "812 Ko");
        assert_eq!(format_size(2_480_000), "2,5 Mo");
        assert_eq!(format_size(3_000_000), "3 Mo");
    }
}
