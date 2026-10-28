//! Now playing on Windows, through the System Media Transport Controls
//! (SMTC): what Spotify, browsers and most players publish to the media
//! flyout. Event-driven: nothing runs until Windows reports a change.
//!
//! WinRT events arrive on arbitrary threads; they only post a message to a
//! worker thread, which reads the session and reports a snapshot.

use std::sync::Arc;
use std::sync::mpsc::{self, Receiver, Sender};

use windows::Foundation::TypedEventHandler;
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession as Session,
    GlobalSystemMediaTransportControlsSessionManager as Manager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
};
use windows::Storage::Streams::DataReader;
use windows::Win32::System::Com::{COINIT_MULTITHREADED, CoInitializeEx};
use windows::core::RuntimeType;

use crate::media::{Artwork, MediaSnapshot};
use crate::platform::{MediaCommand, MediaControl, RepeatMode};
use windows::Media::MediaPlaybackAutoRepeatMode as AutoRepeat;

#[derive(Clone, Copy)]
enum Msg {
    /// The current session may have changed.
    Rebind,
    /// Something changed in the current session; `properties` when title,
    /// artist or cover did (they are costlier to read).
    Refresh {
        properties: bool,
    },
    Command(MediaCommand),
}

/// 100 ns ticks between 1601-01-01 (Windows) and 1970-01-01 (Unix).
const UNIX_EPOCH_TICKS: i64 = 116_444_736_000_000_000;

/// A WinRT `DateTime` (100 ns ticks since 1601) as Unix milliseconds.
pub fn unix_ms(ticks: i64) -> u64 {
    u64::try_from((ticks - UNIX_EPOCH_TICKS) / 10_000).unwrap_or(0)
}

/// Position and duration in ms from SMTC timeline values (100 ns ticks).
/// Apps that do not publish a timeline report zeros: no duration then.
pub fn timeline_ms(start: i64, end: i64, position: i64) -> (Option<u64>, Option<u64>) {
    if end <= start {
        return (None, None);
    }
    let duration = u64::try_from((end - start) / 10_000).ok();
    let position = u64::try_from((position - start).max(0) / 10_000).ok();
    (position.map(|p| p.min(duration.unwrap_or(p))), duration)
}

pub fn start_media(
    on_update: impl Fn(Option<MediaSnapshot>) + Send + 'static,
) -> Option<MediaControl> {
    let (tx, rx) = mpsc::channel();
    let worker_tx = tx.clone();
    let spawned = std::thread::Builder::new()
        .name("quiera-media".into())
        .spawn(move || {
            if let Err(e) = run(worker_tx, rx, on_update) {
                log::error!("media watcher stopped: {e}");
            }
        });
    if let Err(e) = spawned {
        log::error!("could not start the media watcher: {e}");
        return None;
    }
    Some(MediaControl::new(move |command| {
        let _ = tx.send(Msg::Command(command));
    }))
}

struct Bound {
    session: Session,
    tokens: [i64; 3],
}

fn unbind(bound: Option<Bound>) {
    if let Some(b) = bound {
        let _ = b.session.RemoveMediaPropertiesChanged(b.tokens[0]);
        let _ = b.session.RemovePlaybackInfoChanged(b.tokens[1]);
        let _ = b.session.RemoveTimelinePropertiesChanged(b.tokens[2]);
    }
}

/// An event handler that only posts `msg` to the worker.
fn post<S, A>(tx: &Sender<Msg>, msg: Msg) -> TypedEventHandler<S, A>
where
    S: RuntimeType + 'static,
    A: RuntimeType + 'static,
{
    let tx = tx.clone();
    TypedEventHandler::new(move |_, _| {
        let _ = tx.send(msg);
        Ok(())
    })
}

fn bind(session: Session, tx: &Sender<Msg>) -> windows::core::Result<Bound> {
    let properties = Msg::Refresh { properties: true };
    let playback = Msg::Refresh { properties: false };
    let tokens = [
        session.MediaPropertiesChanged(&post(tx, properties))?,
        session.PlaybackInfoChanged(&post(tx, playback))?,
        session.TimelinePropertiesChanged(&post(tx, playback))?,
    ];
    Ok(Bound { session, tokens })
}

fn is_playing(session: &Session) -> bool {
    session
        .GetPlaybackInfo()
        .and_then(|info| info.PlaybackStatus())
        .is_ok_and(|status| status == Status::Playing)
}

/// The session to show. Windows' current one is not always right: it can
/// stay on a paused video while music plays in another app. So what plays
/// comes first, and while nothing plays the island stays where it was.
fn pick(manager: &Manager, sessions: &[Session], bound: Option<&Session>) -> Option<Session> {
    let current = manager.GetCurrentSession().ok();
    current
        .iter()
        .chain(bound)
        .chain(sessions)
        .find(|s| is_playing(s))
        .or_else(|| bound.filter(|b| sessions.contains(b)))
        .cloned()
        .or(current)
}

/// Play and pause in every session, so music starting behind a paused
/// video is noticed. Re-subscribed only when the sessions change.
fn watch_all(sessions: &[Session], watched: &mut Vec<(Session, i64)>, tx: &Sender<Msg>) {
    if watched.len() == sessions.len() && watched.iter().zip(sessions).all(|((w, _), s)| w == s) {
        return;
    }
    for (session, token) in watched.drain(..) {
        let _ = session.RemovePlaybackInfoChanged(token);
    }
    for session in sessions {
        if let Ok(token) = session.PlaybackInfoChanged(&post(tx, Msg::Rebind)) {
            watched.push((session.clone(), token));
        }
    }
}

fn run(
    tx: Sender<Msg>,
    rx: Receiver<Msg>,
    on_update: impl Fn(Option<MediaSnapshot>),
) -> windows::core::Result<()> {
    // SAFETY: initialises COM for this worker thread only. The blocking
    // `join()` calls below need a multithreaded apartment.
    unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }.ok()?;
    let manager = Manager::RequestAsync()?.join()?;
    manager.CurrentSessionChanged(&post(&tx, Msg::Rebind))?;
    manager.SessionsChanged(&post(&tx, Msg::Rebind))?;
    log::info!("media watcher started");

    let mut bound: Option<Bound> = None;
    let mut watched = Vec::new();
    // Title, artist and cover, re-read only when the app says they changed.
    let mut properties = Properties::default();
    let _ = tx.send(Msg::Rebind);

    for msg in rx {
        match msg {
            Msg::Rebind => {
                let sessions: Vec<Session> = manager
                    .GetSessions()
                    .map(|list| list.into_iter().collect())
                    .unwrap_or_default();
                watch_all(&sessions, &mut watched, &tx);
                let current = pick(&manager, &sessions, bound.as_ref().map(|b| &b.session));
                let same = match (&bound, &current) {
                    (Some(b), Some(c)) => b.session == *c,
                    (None, None) => true,
                    _ => false,
                };
                if !same {
                    unbind(bound.take());
                    bound = current.and_then(|s| bind(s, &tx).ok());
                    properties = Properties::default();
                }
                if let Some(b) = &bound {
                    properties = Properties::read(&b.session);
                }
                on_update(bound.as_ref().map(|b| snapshot(&b.session, &properties)));
            }
            Msg::Refresh {
                properties: changed,
            } => {
                if let Some(b) = &bound {
                    if changed {
                        properties = Properties::read(&b.session);
                    }
                    on_update(Some(snapshot(&b.session, &properties)));
                }
            }
            Msg::Command(command) => {
                if let Some(b) = &bound
                    && let Err(e) = execute(&b.session, command)
                {
                    log::warn!("media command {command:?} failed: {e}");
                }
            }
        }
    }
    Ok(())
}

#[derive(Default)]
struct Properties {
    title: String,
    artist: String,
    album: String,
    artwork: Option<Arc<Artwork>>,
}

impl Properties {
    fn read(session: &Session) -> Self {
        let Ok(props) = session
            .TryGetMediaPropertiesAsync()
            .and_then(|op| op.join())
        else {
            return Self::default();
        };
        Self {
            title: props.Title().map(|s| s.to_string()).unwrap_or_default(),
            artist: props.Artist().map(|s| s.to_string()).unwrap_or_default(),
            album: props
                .AlbumTitle()
                .map(|s| s.to_string())
                .unwrap_or_default(),
            artwork: props
                .Thumbnail()
                .ok()
                .and_then(|t| read_artwork(&t).ok())
                .map(Arc::new),
        }
    }
}

pub(super) fn read_artwork(
    thumbnail: &windows::Storage::Streams::IRandomAccessStreamReference,
) -> windows::core::Result<Artwork> {
    let stream = thumbnail.OpenReadAsync()?.join()?;
    let size = u32::try_from(stream.Size()?).unwrap_or(0);
    let reader = DataReader::CreateDataReader(&stream)?;
    reader.LoadAsync(size)?.join()?;
    let mut bytes = vec![0u8; size as usize];
    reader.ReadBytes(&mut bytes)?;
    let mime = stream
        .ContentType()
        .map(|s| s.to_string())
        .unwrap_or_default();
    Ok(Artwork {
        bytes,
        mime: if mime.is_empty() {
            "image/png".into()
        } else {
            mime
        },
    })
}

fn snapshot(session: &Session, properties: &Properties) -> MediaSnapshot {
    let app_id = session
        .SourceAppUserModelId()
        .map(|s| s.to_string())
        .unwrap_or_default();
    let info = session.GetPlaybackInfo().ok();
    let controls = info.as_ref().and_then(|i| i.Controls().ok());
    let enabled = |f: fn(
        &windows::Media::Control::GlobalSystemMediaTransportControlsSessionPlaybackControls,
    ) -> windows::core::Result<bool>| {
        controls.as_ref().and_then(|c| f(c).ok()).unwrap_or(false)
    };
    let playing = info
        .as_ref()
        .and_then(|i| i.PlaybackStatus().ok())
        .is_some_and(|s| s == Status::Playing);

    let (mut position_ms, mut duration_ms, mut position_at_ms) = (None, None, 0);
    if let Ok(t) = session.GetTimelineProperties() {
        let ticks = |r: windows::core::Result<windows::Foundation::TimeSpan>| {
            r.map(|v| v.Duration).unwrap_or(0)
        };
        (position_ms, duration_ms) = timeline_ms(
            ticks(t.StartTime()),
            ticks(t.EndTime()),
            ticks(t.Position()),
        );
        position_at_ms = t
            .LastUpdatedTime()
            .map(|d| unix_ms(d.UniversalTime))
            .unwrap_or(0);
    }

    MediaSnapshot {
        app_id,
        title: properties.title.clone(),
        artist: properties.artist.clone(),
        album: properties.album.clone(),
        playing,
        position_ms,
        duration_ms,
        position_at_ms,
        can_seek: enabled(|c| c.IsPlaybackPositionEnabled()) && duration_ms.is_some(),
        can_previous: enabled(|c| c.IsPreviousEnabled()),
        can_next: enabled(|c| c.IsNextEnabled()),
        can_play_pause: enabled(|c| c.IsPlayPauseToggleEnabled()),
        shuffle: info
            .as_ref()
            .and_then(|i| i.IsShuffleActive().ok())
            .and_then(|v| v.Value().ok()),
        repeat: info
            .as_ref()
            .and_then(|i| i.AutoRepeatMode().ok())
            .and_then(|v| v.Value().ok())
            .map(|m| match m {
                AutoRepeat::Track => RepeatMode::Track,
                AutoRepeat::List => RepeatMode::List,
                _ => RepeatMode::None,
            }),
        can_shuffle: enabled(|c| c.IsShuffleEnabled()),
        can_repeat: enabled(|c| c.IsRepeatEnabled()),
        artwork: properties.artwork.clone(),
    }
}

fn execute(session: &Session, command: MediaCommand) -> windows::core::Result<()> {
    let done = match command {
        MediaCommand::PlayPause => session.TryTogglePlayPauseAsync()?.join()?,
        MediaCommand::Next => session.TrySkipNextAsync()?.join()?,
        MediaCommand::Previous => session.TrySkipPreviousAsync()?.join()?,
        MediaCommand::Seek(ms) => {
            let start = session
                .GetTimelineProperties()
                .and_then(|t| t.StartTime())
                .map(|s| s.Duration)
                .unwrap_or(0);
            let ticks = start + i64::try_from(ms).unwrap_or(i64::MAX / 10_000) * 10_000;
            session.TryChangePlaybackPositionAsync(ticks)?.join()?
        }
        MediaCommand::SetShuffle(active) => session.TryChangeShuffleActiveAsync(active)?.join()?,
        MediaCommand::SetRepeat(mode) => {
            let mode = match mode {
                RepeatMode::None => AutoRepeat::None,
                RepeatMode::Track => AutoRepeat::Track,
                RepeatMode::List => AutoRepeat::List,
            };
            session.TryChangeAutoRepeatModeAsync(mode)?.join()?
        }
    };
    if !done {
        log::info!("the media app declined {command:?}");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_windows_time_to_unix_ms() {
        assert_eq!(unix_ms(UNIX_EPOCH_TICKS), 0);
        // 2026-01-01T00:00:00Z
        assert_eq!(
            unix_ms(UNIX_EPOCH_TICKS + 1_767_225_600_000 * 10_000),
            1_767_225_600_000
        );
        assert_eq!(unix_ms(0), 0, "before 1970 clamps to 0");
    }

    #[test]
    fn reads_position_and_duration_relative_to_the_start() {
        let s = 10_000_000; // 1 s
        assert_eq!(
            timeline_ms(s, s + 180 * 10_000_000, s + 42 * 10_000_000),
            (Some(42_000), Some(180_000))
        );
    }

    #[test]
    fn has_no_timeline_when_the_app_publishes_none() {
        assert_eq!(timeline_ms(0, 0, 0), (None, None));
    }

    #[test]
    fn clamps_the_position_into_the_track() {
        assert_eq!(
            timeline_ms(0, 100_000_000, 200_000_000),
            (Some(10_000), Some(10_000))
        );
        assert_eq!(
            timeline_ms(50_000_000, 150_000_000, 0),
            (Some(0), Some(10_000))
        );
    }
}
