use std::time::{SystemTime, UNIX_EPOCH};

/// Generate a v4-shaped pseudo-UUID without an external crate.
/// Not crypto-grade, but unique enough for in-process record IDs.
pub(crate) fn gen_id() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let seed = now.as_nanos();
    format!(
        "{:08x}-{:04x}-4{:03x}-{:04x}-{:012x}",
        (seed & 0xFFFF_FFFF) as u32,
        ((seed >> 32) & 0xFFFF) as u16,
        ((seed >> 48) & 0x0FFF) as u16,
        (((seed >> 60) & 0x3F) | 0x80) as u16 | (((seed >> 66) & 0xFF) as u16) << 8,
        (seed >> 74) & 0xFFFF_FFFF_FFFF,
    )
}

/// Stable djb2 hash → hex, used for deterministic project IDs derived from
/// the canonical repo path. Matches the frontend's `deterministicId` for
/// ASCII paths; may diverge for non-ASCII (acceptable: callers don't compare
/// across the boundary, they read the persisted ID).
pub(crate) fn deterministic_id(prefix: &str, input: &str) -> String {
    let mut h: u32 = 5381;
    for b in input.bytes() {
        h = ((h << 5).wrapping_add(h)) ^ (b as u32);
    }
    format!("{}_{:08x}", prefix, h)
}

pub(crate) fn now_iso8601() -> String {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();
    let days = secs / 86400;
    let time_secs = secs % 86400;
    let hours = time_secs / 3600;
    let minutes = (time_secs % 3600) / 60;
    let seconds = time_secs % 60;

    let mut y = 1970i64;
    let mut remaining_days = days as i64;
    loop {
        let days_in_year = if is_leap(y) { 366 } else { 365 };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        y += 1;
    }
    let months_days: [i64; 12] = if is_leap(y) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut m = 1;
    for md in months_days.iter() {
        if remaining_days < *md {
            break;
        }
        remaining_days -= md;
        m += 1;
    }
    let d = remaining_days + 1;

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        y, m, d, hours, minutes, seconds
    )
}

fn is_leap(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}
