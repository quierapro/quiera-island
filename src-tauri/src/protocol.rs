//! URLs of Quiera's custom protocols as the web view loads them: Windows
//! web views see custom schemes as `http://<scheme>.localhost`.

pub fn url(scheme: &str, path: &str) -> String {
    if cfg!(windows) {
        format!("http://{scheme}.localhost/{path}")
    } else {
        format!("{scheme}://localhost/{path}")
    }
}
