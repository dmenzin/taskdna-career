# Freshness

Synthetic jobs use production-shaped freshness states:

- `VERIFIED_LIVE`
- `REVERIFIED_LIVE`
- `PREVIOUSLY_FOUND_NOT_RECHECKED`
- `POSSIBLY_STALE`
- `CONFIRMED_CLOSED`

Failure to reverify is not treated as confirmed closed. Freshness is shown as metadata and can be filtered in future UI refinements.
