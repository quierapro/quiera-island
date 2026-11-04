//! The calendar: upcoming events, read from iCal links (the "secret
//! address" Google Calendar and Outlook give for a calendar), so no account
//! has to be connected. Refreshed every 15 minutes, when the links change,
//! and on demand.
//!
//! Recurring events are expanded (RRULE, EXDATE, moved occurrences), in
//! their own time zone, IANA ("Europe/Paris", Google) or Windows' ("Romance
//! Standard Time", Outlook). A meeting's Teams, Meet, Zoom or Webex link is
//! found in its conference field, location, URL or description.
//!
//! Nothing of the events nor of the links is ever logged: a secret link
//! gives access to the whole calendar.

use std::collections::HashSet;
use std::io::Read;
use std::sync::{LazyLock, Mutex};
use std::time::Duration;

use chrono::{DateTime, Duration as Span, Local, NaiveDate, NaiveDateTime, TimeZone, Utc};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub const EVENTS_EVENT: &str = "calendar://events";
const REFRESH_EVERY: Duration = Duration::from_secs(15 * 60);
const TIMEOUT: Duration = Duration::from_secs(15);
/// A whole calendar's history can be large; past this it is refused.
const MAX_BODY: u64 = 20 << 20;
/// Events shown: from a little before now to a week ahead.
const PAST: i64 = 12;
const AHEAD_DAYS: i64 = 8;
const MAX_EVENTS: usize = 200;
/// Occurrences of one recurring event, at most, in the window.
const MAX_OCCURRENCES: u16 = 100;

/// An upcoming event, for the island.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    pub id: String,
    pub title: String,
    /// Milliseconds since 1970.
    pub start: i64,
    pub end: i64,
    pub all_day: bool,
    pub location: String,
    /// The meeting's link, when it has one.
    pub join: Option<String>,
    /// "teams", "meet", "zoom" or "webex".
    pub service: Option<&'static str>,
}

/// What reading a link found, for the settings.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkCheck {
    /// The calendar's own name, when it gives one.
    pub name: Option<String>,
    /// Events in the coming week.
    pub upcoming: usize,
}

// ---- Reading iCalendar

/// A moment as the file writes it.
#[derive(Debug, Clone, Copy, PartialEq)]
enum Stamp {
    /// A whole day ("VALUE=DATE").
    Date(NaiveDate),
    Utc(DateTime<Utc>),
    Zoned(NaiveDateTime, chrono_tz::Tz),
    /// No zone: the computer's.
    Floating(NaiveDateTime),
}

fn local(naive: NaiveDateTime) -> DateTime<Utc> {
    Local
        .from_local_datetime(&naive)
        .earliest()
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or_else(|| Utc.from_utc_datetime(&naive))
}

impl Stamp {
    fn utc(self) -> DateTime<Utc> {
        match self {
            Stamp::Date(d) => local(d.and_hms_opt(0, 0, 0).unwrap_or_default()),
            Stamp::Utc(t) => t,
            Stamp::Zoned(n, tz) => tz
                .from_local_datetime(&n)
                .earliest()
                .map(|d| d.with_timezone(&Utc))
                .unwrap_or_else(|| Utc.from_utc_datetime(&n)),
            Stamp::Floating(n) => local(n),
        }
    }

    /// The same moment for recurrence: in its own zone, so a weekly meeting
    /// at 10:00 stays at 10:00 across a daylight saving change.
    fn for_rrule(self) -> DateTime<rrule::Tz> {
        match self {
            Stamp::Zoned(n, tz) => tz
                .from_local_datetime(&n)
                .earliest()
                .map(|d| d.with_timezone(&rrule::Tz::Tz(tz)))
                .unwrap_or_else(|| self.utc().with_timezone(&rrule::Tz::UTC)),
            Stamp::Utc(t) => t.with_timezone(&rrule::Tz::UTC),
            Stamp::Date(_) | Stamp::Floating(_) => self.utc().with_timezone(&rrule::Tz::LOCAL),
        }
    }
}

/// Windows' zone names (Outlook's) to IANA ones, for the most common.
const WINDOWS_ZONES: &[(&str, &str)] = &[
    ("Romance Standard Time", "Europe/Paris"),
    ("W. Europe Standard Time", "Europe/Berlin"),
    ("Central Europe Standard Time", "Europe/Budapest"),
    ("Central European Standard Time", "Europe/Warsaw"),
    ("GMT Standard Time", "Europe/London"),
    ("Greenwich Standard Time", "Atlantic/Reykjavik"),
    ("E. Europe Standard Time", "Europe/Chisinau"),
    ("FLE Standard Time", "Europe/Kiev"),
    ("GTB Standard Time", "Europe/Bucharest"),
    ("Russian Standard Time", "Europe/Moscow"),
    ("Turkey Standard Time", "Europe/Istanbul"),
    ("Morocco Standard Time", "Africa/Casablanca"),
    ("W. Central Africa Standard Time", "Africa/Lagos"),
    ("South Africa Standard Time", "Africa/Johannesburg"),
    ("Egypt Standard Time", "Africa/Cairo"),
    ("Israel Standard Time", "Asia/Jerusalem"),
    ("Arab Standard Time", "Asia/Riyadh"),
    ("Arabian Standard Time", "Asia/Dubai"),
    ("India Standard Time", "Asia/Kolkata"),
    ("China Standard Time", "Asia/Shanghai"),
    ("Singapore Standard Time", "Asia/Singapore"),
    ("Tokyo Standard Time", "Asia/Tokyo"),
    ("Korea Standard Time", "Asia/Seoul"),
    ("AUS Eastern Standard Time", "Australia/Sydney"),
    ("E. Australia Standard Time", "Australia/Brisbane"),
    ("Cen. Australia Standard Time", "Australia/Adelaide"),
    ("W. Australia Standard Time", "Australia/Perth"),
    ("New Zealand Standard Time", "Pacific/Auckland"),
    ("Eastern Standard Time", "America/New_York"),
    ("Central Standard Time", "America/Chicago"),
    ("Mountain Standard Time", "America/Denver"),
    ("Pacific Standard Time", "America/Los_Angeles"),
    ("US Mountain Standard Time", "America/Phoenix"),
    ("Alaskan Standard Time", "America/Anchorage"),
    ("Hawaiian Standard Time", "Pacific/Honolulu"),
    ("Atlantic Standard Time", "America/Halifax"),
    ("Canada Central Standard Time", "America/Regina"),
    ("Newfoundland Standard Time", "America/St_Johns"),
    ("Central Standard Time (Mexico)", "America/Mexico_City"),
    ("SA Pacific Standard Time", "America/Bogota"),
    ("E. South America Standard Time", "America/Sao_Paulo"),
    ("Argentina Standard Time", "America/Buenos_Aires"),
    ("UTC", "UTC"),
    ("Coordinated Universal Time", "UTC"),
];

/// A TZID: IANA, Windows', or a path ending in an IANA name
/// ("/mozilla.org/…/Europe/Paris"). None for one it cannot place.
fn zone(tzid: &str) -> Option<chrono_tz::Tz> {
    let tzid = tzid.trim().trim_matches('"');
    if let Ok(tz) = tzid.parse() {
        return Some(tz);
    }
    if let Some((_, iana)) = WINDOWS_ZONES
        .iter()
        .find(|(w, _)| w.eq_ignore_ascii_case(tzid))
    {
        return iana.parse().ok();
    }
    // The longest IANA-looking ending of a path.
    let parts: Vec<&str> = tzid.split('/').collect();
    (0..parts.len()).find_map(|i| parts[i..].join("/").parse().ok())
}

/// A property's parameters, like `TZID=Europe/Paris`.
type Params = Vec<(String, String)>;

fn parse_stamp(value: &str, params: &[(String, String)]) -> Option<Stamp> {
    let value = value.trim();
    let param = |name: &str| {
        params
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(name))
            .map(|(_, v)| v.as_str())
    };
    if param("VALUE").is_some_and(|v| v.eq_ignore_ascii_case("DATE")) || value.len() == 8 {
        return NaiveDate::parse_from_str(value, "%Y%m%d")
            .ok()
            .map(Stamp::Date);
    }
    if let Some(utc) = value.strip_suffix('Z') {
        let naive = NaiveDateTime::parse_from_str(utc, "%Y%m%dT%H%M%S").ok()?;
        return Some(Stamp::Utc(Utc.from_utc_datetime(&naive)));
    }
    let naive = NaiveDateTime::parse_from_str(value, "%Y%m%dT%H%M%S").ok()?;
    Some(match param("TZID").and_then(zone) {
        Some(tz) => Stamp::Zoned(naive, tz),
        None => Stamp::Floating(naive),
    })
}

/// "PT1H30M", "P1D", "-PT15M": an iCalendar duration.
fn parse_duration(text: &str) -> Option<Span> {
    let text = text.trim();
    let (negative, text) = match text.strip_prefix('-') {
        Some(rest) => (true, rest),
        None => (false, text.strip_prefix('+').unwrap_or(text)),
    };
    let text = text.strip_prefix('P')?;
    let mut total = Span::zero();
    let mut number = String::new();
    let mut in_time = false;
    for c in text.chars() {
        match c {
            'T' => in_time = true,
            '0'..='9' => number.push(c),
            unit => {
                let n: i64 = number.parse().ok()?;
                number.clear();
                total += match (unit, in_time) {
                    ('W', false) => Span::weeks(n),
                    ('D', false) => Span::days(n),
                    ('H', true) => Span::hours(n),
                    ('M', true) => Span::minutes(n),
                    ('S', true) => Span::seconds(n),
                    _ => return None,
                };
            }
        }
    }
    Some(if negative { -total } else { total })
}

/// "\\n", "\\,", "\\;" and "\\\\" as the text they stand for.
fn unescape(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut chars = text.chars();
    while let Some(c) = chars.next() {
        if c != '\\' {
            out.push(c);
            continue;
        }
        match chars.next() {
            Some('n' | 'N') => out.push('\n'),
            Some(other) => out.push(other),
            None => {}
        }
    }
    out
}

/// One property line: name, parameters, value.
fn content_line(line: &str) -> Option<(String, Params, &str)> {
    // The value starts at the first colon outside quotes.
    let mut quoted = false;
    let colon = line.char_indices().find_map(|(i, c)| {
        match c {
            '"' => quoted = !quoted,
            ':' if !quoted => return Some(i),
            _ => {}
        }
        None
    })?;
    let (head, value) = (&line[..colon], &line[colon + 1..]);
    let mut parts = head.split(';');
    let name = parts.next()?.trim().to_ascii_uppercase();
    let params = parts
        .filter_map(|p| p.split_once('='))
        .map(|(k, v)| {
            (
                k.trim().to_ascii_uppercase(),
                v.trim().trim_matches('"').to_owned(),
            )
        })
        .collect();
    Some((name, params, value))
}

#[derive(Debug, Default, Clone)]
struct Raw {
    uid: String,
    summary: String,
    start: Option<Stamp>,
    end: Option<Stamp>,
    duration: Option<Span>,
    location: String,
    description: String,
    url: String,
    conference: String,
    rrule: Option<String>,
    exdates: Vec<Stamp>,
    recurrence_id: Option<Stamp>,
    cancelled: bool,
}

/// The calendar's name and its events, from an .ics file.
fn parse(ics: &str) -> (Option<String>, Vec<Raw>) {
    // Unfold: a line starting with a space or a tab continues the previous one.
    let mut lines: Vec<String> = Vec::new();
    for line in ics.split('\n') {
        let line = line.strip_suffix('\r').unwrap_or(line);
        match line.strip_prefix([' ', '\t']) {
            Some(rest) if !lines.is_empty() => lines.last_mut().unwrap().push_str(rest),
            _ => lines.push(line.to_owned()),
        }
    }
    let mut name = None;
    let mut events = Vec::new();
    let mut current: Option<Raw> = None;
    // Inside a VALARM (or another component) of an event: its lines are not the event's.
    let mut nested = 0usize;
    for line in &lines {
        let Some((key, params, value)) = content_line(line) else {
            continue;
        };
        match key.as_str() {
            "BEGIN" if value.eq_ignore_ascii_case("VEVENT") && current.is_none() => {
                current = Some(Raw::default());
                nested = 0;
                continue;
            }
            "END" if value.eq_ignore_ascii_case("VEVENT") && nested == 0 => {
                if let Some(event) = current.take()
                    && event.start.is_some()
                {
                    events.push(event);
                }
                continue;
            }
            "BEGIN" if current.is_some() => {
                nested += 1;
                continue;
            }
            "END" if current.is_some() => {
                nested = nested.saturating_sub(1);
                continue;
            }
            "X-WR-CALNAME" if current.is_none() => {
                name = Some(unescape(value)).filter(|n| !n.trim().is_empty());
                continue;
            }
            _ => {}
        }
        let Some(event) = current.as_mut().filter(|_| nested == 0) else {
            continue;
        };
        match key.as_str() {
            "UID" => event.uid = value.to_owned(),
            "SUMMARY" => event.summary = unescape(value),
            "DTSTART" => event.start = parse_stamp(value, &params),
            "DTEND" => event.end = parse_stamp(value, &params),
            "DURATION" => event.duration = parse_duration(value),
            "LOCATION" => event.location = unescape(value),
            "DESCRIPTION" => event.description = unescape(value),
            "URL" => event.url = value.to_owned(),
            "X-GOOGLE-CONFERENCE" | "X-MICROSOFT-SKYPETEAMSMEETINGURL" | "CONFERENCE" => {
                event.conference = value.to_owned();
            }
            "RRULE" => event.rrule = Some(value.to_owned()),
            "EXDATE" => event
                .exdates
                .extend(value.split(',').filter_map(|v| parse_stamp(v, &params))),
            "RECURRENCE-ID" => event.recurrence_id = parse_stamp(value, &params),
            "STATUS" => event.cancelled = value.eq_ignore_ascii_case("CANCELLED"),
            _ => {}
        }
    }
    (name, events)
}

// ---- Meeting links

/// The service a link belongs to, from its host.
fn service(url: &str) -> Option<&'static str> {
    let rest = url.strip_prefix("https://")?;
    let host = rest.split(['/', '?', '#']).next()?.to_ascii_lowercase();
    let is = |domain: &str| host == domain || host.ends_with(&format!(".{domain}"));
    if is("teams.microsoft.com") || is("teams.live.com") {
        Some("teams")
    } else if is("meet.google.com") {
        Some("meet")
    } else if is("zoom.us")
        && (rest.contains("/j/") || rest.contains("/my/") || rest.contains("/w/"))
    {
        Some("zoom")
    } else if is("webex.com") {
        Some("webex")
    } else {
        None
    }
}

/// The first meeting link in these texts, in order.
fn join_link(texts: &[&str]) -> Option<(String, &'static str)> {
    for text in texts {
        let mut rest = *text;
        while let Some(at) = rest.find("https://") {
            let candidate = &rest[at..];
            let end = candidate
                .find(|c: char| c.is_whitespace() || "\"'<>()[]|".contains(c))
                .unwrap_or(candidate.len());
            let url = candidate[..end].trim_end_matches(['.', ',', ';', ':']);
            if let Some(kind) = service(url) {
                return Some((url.to_owned(), kind));
            }
            rest = &candidate[end.max(8)..];
        }
    }
    None
}

// ---- Occurrences

fn event_at(raw: &Raw, start: DateTime<Utc>, length: Span) -> Event {
    let join = join_link(&[&raw.conference, &raw.location, &raw.url, &raw.description]);
    let all_day = matches!(raw.start, Some(Stamp::Date(_)));
    let title = raw.summary.trim();
    Event {
        id: format!("{}@{}", raw.uid, start.timestamp_millis()),
        title: if title.is_empty() {
            "—".into()
        } else {
            title.to_owned()
        },
        start: start.timestamp_millis(),
        end: (start + length).timestamp_millis(),
        all_day,
        location: raw
            .location
            .lines()
            .next()
            .unwrap_or_default()
            .trim()
            .to_owned(),
        service: join.as_ref().map(|(_, s)| *s),
        join: join.map(|(url, _)| url),
    }
}

/// How long an event lasts: to its end, or its duration, or (per the
/// standard) a day for a whole-day event and nothing for a moment.
fn length(raw: &Raw, start: Stamp) -> Span {
    if let Some(end) = raw.end {
        return (end.utc() - start.utc()).max(Span::zero());
    }
    raw.duration.unwrap_or(match start {
        Stamp::Date(_) => Span::days(1),
        _ => Span::zero(),
    })
}

/// The events between `from` and `to`, recurring ones expanded, sorted.
fn occurrences(raws: &[Raw], from: DateTime<Utc>, to: DateTime<Utc>) -> Vec<Event> {
    // Occurrences moved or cancelled one by one replace their original.
    let overridden: HashSet<(String, i64)> = raws
        .iter()
        .filter_map(|r| Some((r.uid.clone(), r.recurrence_id?.utc().timestamp_millis())))
        .collect();
    let mut out = Vec::new();
    for raw in raws {
        let Some(start) = raw.start else { continue };
        let span = length(raw, start);
        if raw.cancelled {
            continue;
        }
        let rule = raw
            .rrule
            .as_ref()
            .filter(|_| raw.recurrence_id.is_none())
            .and_then(|rule| rule.parse::<rrule::RRule<rrule::Unvalidated>>().ok())
            .and_then(|rule| rule.build(start.for_rrule()).ok());
        match rule {
            Some(mut set) => {
                for exdate in &raw.exdates {
                    set = set.exdate(exdate.for_rrule());
                }
                let window_from = (from - span).with_timezone(&rrule::Tz::UTC);
                let window_to = to.with_timezone(&rrule::Tz::UTC);
                for at in set
                    .after(window_from)
                    .before(window_to)
                    .all(MAX_OCCURRENCES)
                    .dates
                {
                    let at = at.with_timezone(&Utc);
                    if !overridden.contains(&(raw.uid.clone(), at.timestamp_millis())) {
                        out.push(event_at(raw, at, span));
                    }
                }
            }
            // A single event, a moved occurrence, or a rule that cannot be read.
            None => {
                let at = start.utc();
                if at < to && at + span > from {
                    out.push(event_at(raw, at, span));
                }
            }
        }
    }
    out.retain(|e| {
        e.end > from.timestamp_millis() || e.end == e.start && e.start >= from.timestamp_millis()
    });
    out.sort_by(|a, b| a.start.cmp(&b.start).then_with(|| a.title.cmp(&b.title)));
    out.dedup_by(|a, b| a.id == b.id);
    out
}

// ---- Fetching

/// "webcal://" is how calendars are often shared: it is HTTPS.
fn normalize(link: &str) -> Option<String> {
    let link = link.trim();
    if let Some(rest) = link.strip_prefix("webcal://") {
        return Some(format!("https://{rest}"));
    }
    link.starts_with("https://").then(|| link.to_owned())
}

/// The file behind a link. Errors never carry the link (it is secret).
fn fetch(link: &str) -> Result<String, String> {
    let url = normalize(link).ok_or("not an https:// or webcal:// link")?;
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(TIMEOUT))
        .user_agent(concat!("Quiera/", env!("CARGO_PKG_VERSION")))
        .build()
        .into();
    let mut response = agent.get(&url).call().map_err(|e| match e {
        ureq::Error::StatusCode(code) => format!("the server answered {code}"),
        ureq::Error::Timeout(_) => "no answer (timeout)".into(),
        _ => "it could not be reached".into(),
    })?;
    let mut body = String::new();
    response
        .body_mut()
        .as_reader()
        .take(MAX_BODY + 1)
        .read_to_string(&mut body)
        .map_err(|_| "it is not a calendar".to_owned())?;
    if body.len() as u64 > MAX_BODY {
        return Err("the calendar is larger than 20 MB".into());
    }
    if !body.contains("BEGIN:VCALENDAR") {
        return Err("it is not a calendar (iCal)".into());
    }
    Ok(body)
}

fn window(now: DateTime<Utc>) -> (DateTime<Utc>, DateTime<Utc>) {
    (now - Span::hours(PAST), now + Span::days(AHEAD_DAYS))
}

static EVENTS: LazyLock<Mutex<Vec<Event>>> = LazyLock::new(Mutex::default);
/// One refresh at a time.
static REFRESHING: Mutex<()> = Mutex::new(());

/// Reads every link again and tells the island.
fn refresh(app: &AppHandle) {
    let _one = REFRESHING.lock().unwrap_or_else(|e| e.into_inner());
    let links = crate::settings::get().calendar.links;
    let (from, to) = window(Utc::now());
    let mut events = Vec::new();
    for (i, link) in links.iter().enumerate() {
        match fetch(link) {
            Ok(ics) => events.extend(occurrences(&parse(&ics).1, from, to)),
            // Which one, by its place only: the link is secret.
            Err(e) => log::warn!("calendar {} could not be read: {e}", i + 1),
        }
    }
    events.sort_by_key(|e| e.start);
    events.truncate(MAX_EVENTS);
    *EVENTS.lock().unwrap_or_else(|e| e.into_inner()) = events.clone();
    let _ = app.emit(EVENTS_EVENT, events);
}

/// At start, and every 15 minutes.
pub fn start(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        loop {
            if !crate::settings::get().calendar.links.is_empty() {
                refresh(&app);
            }
            std::thread::sleep(REFRESH_EVERY);
        }
    });
}

/// The links changed: read them again now.
pub fn links_changed(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || refresh(&app));
}

#[tauri::command]
pub fn calendar_events() -> Vec<Event> {
    EVENTS.lock().unwrap_or_else(|e| e.into_inner()).clone()
}

#[tauri::command]
pub async fn calendar_refresh(app: AppHandle) {
    let _ = tauri::async_runtime::spawn_blocking(move || refresh(&app)).await;
}

/// Reads a link before it is added: its name and how many events are coming.
#[tauri::command]
pub async fn calendar_check(link: String) -> Result<LinkCheck, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let ics = fetch(&link)?;
        let (name, raws) = parse(&ics);
        let (from, to) = window(Utc::now());
        Ok(LinkCheck {
            name,
            upcoming: occurrences(&raws, from, to).len(),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(text: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(text)
            .unwrap()
            .with_timezone(&Utc)
    }

    fn ms(text: &str) -> i64 {
        at(text).timestamp_millis()
    }

    const GOOGLE: &str = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nX-WR-CALNAME:Travail\r\n\
BEGIN:VEVENT\r\nUID:daily@google\r\nSUMMARY:Daily\r\n\
DTSTART;TZID=Europe/Paris:20261102T100000\r\nDTEND;TZID=Europe/Paris:20261102T101500\r\n\
RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR\r\nEXDATE;TZID=Europe/Paris:20261105T100000\r\n\
DESCRIPTION:Rejoindre avec Google Meet : https://meet.google.com/abc-defg-hij\\nOu par t\r\n éléphone\r\n\
BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Not the event's\r\nEND:VALARM\r\n\
END:VEVENT\r\n\
BEGIN:VEVENT\r\nUID:daily@google\r\nRECURRENCE-ID;TZID=Europe/Paris:20261104T100000\r\n\
SUMMARY:Daily (déplacé)\r\nDTSTART;TZID=Europe/Paris:20261104T143000\r\nDTEND;TZID=Europe/Paris:20261104T144500\r\n\
END:VEVENT\r\n\
BEGIN:VEVENT\r\nUID:off@google\r\nSUMMARY:Férié\r\nDTSTART;VALUE=DATE:20261111\r\nDTEND;VALUE=DATE:20261112\r\nEND:VEVENT\r\n\
BEGIN:VEVENT\r\nUID:gone@google\r\nSUMMARY:Annulé\r\nSTATUS:CANCELLED\r\nDTSTART:20261104T120000Z\r\nEND:VEVENT\r\n\
END:VCALENDAR\r\n";

    const OUTLOOK: &str = "BEGIN:VCALENDAR\r\nBEGIN:VTIMEZONE\r\nTZID:Romance Standard Time\r\nEND:VTIMEZONE\r\n\
BEGIN:VEVENT\r\nUID:review@outlook\r\nSUMMARY:Revue\\, sprint 12\r\n\
DTSTART;TZID=Romance Standard Time:20261104T160000\r\nDURATION:PT1H\r\n\
LOCATION:Réunion Microsoft Teams\r\n\
X-MICROSOFT-SKYPETEAMSMEETINGURL:https://teams.microsoft.com/l/meetup-join/19%3ameeting_x%40thread.v2/0\r\n\
END:VEVENT\r\nEND:VCALENDAR\r\n";

    #[test]
    fn reads_the_name_and_unfolds_lines() {
        let (name, raws) = parse(GOOGLE);
        assert_eq!(name.as_deref(), Some("Travail"));
        assert_eq!(
            raws[0].description,
            "Rejoindre avec Google Meet : https://meet.google.com/abc-defg-hij\nOu par téléphone"
        );
        assert_eq!(raws.len(), 4);
    }

    #[test]
    fn expands_a_weekly_meeting_in_its_zone() {
        let (_, raws) = parse(GOOGLE);
        let events = occurrences(
            &raws,
            at("2026-11-02T00:00:00Z"),
            at("2026-11-07T00:00:00Z"),
        );
        let dailies: Vec<(&str, i64)> = events
            .iter()
            .filter(|e| e.title.starts_with("Daily"))
            .map(|e| (e.title.as_str(), e.start))
            .collect();
        // 10:00 in Paris is 09:00 UTC in November; Thursday is excluded and
        // Wednesday's was moved to 14:30.
        assert_eq!(
            dailies,
            [
                ("Daily", ms("2026-11-02T09:00:00Z")),
                ("Daily", ms("2026-11-03T09:00:00Z")),
                ("Daily (déplacé)", ms("2026-11-04T13:30:00Z")),
                ("Daily", ms("2026-11-06T09:00:00Z")),
            ]
        );
        let first = events.iter().find(|e| e.title == "Daily").unwrap();
        assert_eq!(first.end - first.start, 15 * 60 * 1000);
        assert_eq!(
            first.join.as_deref(),
            Some("https://meet.google.com/abc-defg-hij")
        );
        assert_eq!(first.service, Some("meet"));
        assert!(!events.iter().any(|e| e.title == "Annulé"));
    }

    #[test]
    fn keeps_the_hour_across_daylight_saving() {
        let (_, raws) = parse(GOOGLE);
        // Paris goes back to winter time on 25 October 2026: in October,
        // 10:00 is 08:00 UTC.
        let october: Vec<_> = occurrences(
            &raws,
            at("2026-10-01T00:00:00Z"),
            at("2026-10-02T00:00:00Z"),
        );
        assert!(october.is_empty(), "the series starts in November");
        let raw = Raw {
            uid: "x".into(),
            start: parse_stamp("20261020T100000", &[("TZID".into(), "Europe/Paris".into())]),
            rrule: Some("FREQ=WEEKLY".into()),
            duration: Some(Span::minutes(30)),
            ..Raw::default()
        };
        let both = occurrences(
            &[raw],
            at("2026-10-19T00:00:00Z"),
            at("2026-10-28T00:00:00Z"),
        );
        assert_eq!(
            both.iter().map(|e| e.start).collect::<Vec<_>>(),
            [ms("2026-10-20T08:00:00Z"), ms("2026-10-27T09:00:00Z")]
        );
    }

    #[test]
    fn reads_outlook_zones_durations_and_teams() {
        let (_, raws) = parse(OUTLOOK);
        let events = occurrences(
            &raws,
            at("2026-11-04T00:00:00Z"),
            at("2026-11-05T00:00:00Z"),
        );
        assert_eq!(events.len(), 1);
        let review = &events[0];
        assert_eq!(review.title, "Revue, sprint 12");
        assert_eq!(review.start, ms("2026-11-04T15:00:00Z"));
        assert_eq!(review.end, ms("2026-11-04T16:00:00Z"));
        assert_eq!(review.service, Some("teams"));
        assert!(
            review
                .join
                .as_deref()
                .unwrap()
                .starts_with("https://teams.microsoft.com/l/meetup-join/")
        );
    }

    #[test]
    fn whole_days_are_whole_days() {
        let (_, raws) = parse(GOOGLE);
        let events = occurrences(
            &raws,
            at("2026-11-10T12:00:00Z"),
            at("2026-11-12T12:00:00Z"),
        );
        let off = events.iter().find(|e| e.title == "Férié").unwrap();
        assert!(off.all_day);
        assert_eq!(off.end - off.start, 24 * 3600 * 1000);
    }

    #[test]
    fn finds_meeting_links_and_only_them() {
        assert_eq!(
            join_link(&["Zoom: https://us02web.zoom.us/j/123456789?pwd=abc."]),
            Some(("https://us02web.zoom.us/j/123456789?pwd=abc".into(), "zoom"))
        );
        assert_eq!(
            join_link(&["<https://acme.webex.com/meet/jo>"]).map(|j| j.1),
            Some("webex")
        );
        assert_eq!(
            join_link(&[
                "https://zoom.us/pricing",
                "https://example.com/meet.google.com"
            ]),
            None
        );
        assert_eq!(join_link(&["http://meet.google.com/abc-defg-hij"]), None);
    }

    #[test]
    fn reads_durations_and_zones() {
        assert_eq!(parse_duration("PT1H30M"), Some(Span::minutes(90)));
        assert_eq!(parse_duration("P1D"), Some(Span::days(1)));
        assert_eq!(parse_duration("-PT15M"), Some(Span::minutes(-15)));
        assert_eq!(parse_duration("1H"), None);
        assert_eq!(zone("Europe/Paris"), Some(chrono_tz::Europe::Paris));
        assert_eq!(
            zone("W. Europe Standard Time"),
            Some(chrono_tz::Europe::Berlin)
        );
        assert_eq!(
            zone("/mozilla.org/20070129_1/Europe/Paris"),
            Some(chrono_tz::Europe::Paris)
        );
        assert_eq!(zone("Customized Time Zone"), None);
    }

    #[test]
    fn takes_secure_links_only() {
        assert_eq!(
            normalize(" webcal://p01-calendars.icloud.com/x "),
            Some("https://p01-calendars.icloud.com/x".into())
        );
        assert_eq!(
            normalize("https://calendar.google.com/x.ics"),
            Some("https://calendar.google.com/x.ics".into())
        );
        assert_eq!(normalize("http://calendar.example.com/x.ics"), None);
        assert_eq!(normalize("file:///C:/x.ics"), None);
    }
}

#[cfg(test)]
mod network_tests {
    use super::*;

    /// A real Google calendar (France's public holidays, public).
    #[test]
    #[ignore = "reaches the network"]
    fn reads_a_real_google_calendar() {
        let ics = fetch("https://calendar.google.com/calendar/ical/fr.french%23holiday%40group.v.calendar.google.com/public/basic.ics").unwrap();
        let (name, raws) = parse(&ics);
        assert!(name.is_some());
        let year = occurrences(&raws, Utc::now(), Utc::now() + Span::days(365));
        assert!(year.len() >= 8, "{} holidays", year.len());
        assert!(year.iter().all(|e| e.all_day));
    }
}
