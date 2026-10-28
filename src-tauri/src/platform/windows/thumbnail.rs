//! File thumbnails from the Windows shell, the same ones Explorer shows:
//! a preview for images, PDFs, videos and documents, the file type's icon
//! for the rest.

use std::ffi::c_void;
use std::path::Path;

use windows::Win32::Foundation::SIZE;
use windows::Win32::Graphics::Gdi::{
    BI_RGB, BITMAP, BITMAPINFO, BITMAPINFOHEADER, DIB_RGB_COLORS, DeleteObject, GetDC, GetDIBits,
    GetObjectW, HBITMAP, ReleaseDC,
};
use windows::Win32::System::Com::{COINIT_APARTMENTTHREADED, CoInitializeEx};
use windows::Win32::UI::Shell::{
    IShellItemImageFactory, SHCreateItemFromParsingName, SIIGBF_BIGGERSIZEOK, SIIGBF_ICONONLY,
    SIIGBF_RESIZETOFIT,
};
use windows::core::HSTRING;

use crate::shelf::{Rgba, encode_png};

/// A PNG thumbnail of `path`, at most `size` × `size` pixels.
pub fn file_thumbnail(path: &Path, size: u32) -> Option<Vec<u8>> {
    // SAFETY: COM is initialised for this thread (a no-op if it already is);
    // the bitmap is created by the shell and freed here.
    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        // The shell parses backslashes only.
        let parsing_name = path.to_string_lossy().replace('/', "\\");
        let factory: IShellItemImageFactory =
            SHCreateItemFromParsingName(&HSTRING::from(parsing_name), None).ok()?;
        let side = i32::try_from(size).ok()?;
        let size = SIZE { cx: side, cy: side };
        // Some file types' preview handlers fail instead of falling back to
        // the icon: ask for the icon alone then.
        let bitmap = factory
            .GetImage(size, SIIGBF_RESIZETOFIT | SIIGBF_BIGGERSIZEOK)
            .or_else(|_| factory.GetImage(size, SIIGBF_ICONONLY))
            .ok()?;
        let pixels = read_bitmap(bitmap);
        let _ = DeleteObject(bitmap.into());
        let image = pixels?;
        encode_png(&image)
    }
}

/// The bitmap's pixels as straight (not premultiplied) RGBA, top row first.
unsafe fn read_bitmap(bitmap: HBITMAP) -> Option<Rgba> {
    unsafe {
        let mut info = BITMAP::default();
        let read = GetObjectW(
            bitmap.into(),
            size_of::<BITMAP>() as i32,
            Some(&mut info as *mut BITMAP as *mut c_void),
        );
        if read == 0 || info.bmWidth <= 0 || info.bmHeight == 0 {
            return None;
        }
        let (width, height) = (info.bmWidth, info.bmHeight.abs());
        let mut header = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                // Negative: rows top to bottom.
                biHeight: -height,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };
        let mut bgra = vec![0u8; width as usize * height as usize * 4];
        let dc = GetDC(None);
        let lines = GetDIBits(
            dc,
            bitmap,
            0,
            height as u32,
            Some(bgra.as_mut_ptr().cast()),
            &mut header,
            DIB_RGB_COLORS,
        );
        ReleaseDC(None, dc);
        (lines > 0).then(|| Rgba::from_premultiplied_bgra(bgra, width as u32, height as u32))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Talks to the real Windows shell: run with `cargo test -- --ignored`.
    /// One test on purpose: some preview handlers (Markdown here) fail when
    /// called from several threads at once, which is why the app renders
    /// thumbnails on a single thread.
    #[test]
    #[ignore]
    fn renders_thumbnails_with_the_windows_shell() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR"));
        let forward_slashes = format!("{}/Cargo.toml", root.display()).replace('\\', "/");
        for path in [
            root.join("icons/128x128@2x.png"),
            root.join("Cargo.toml"),
            root.join("src"),
            root.parent().unwrap().join("README.md"),
            forward_slashes.into(),
        ] {
            let png =
                file_thumbnail(&path, 128).unwrap_or_else(|| panic!("no thumbnail for {path:?}"));
            assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n", "{path:?}");
        }
    }
}
