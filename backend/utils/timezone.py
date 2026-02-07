"""
Japan Standard Time (JST / Asia/Tokyo) utilities.
All date/time operations in this app should use these helpers
to ensure consistent JST regardless of the server's system timezone.
"""

from datetime import datetime, date, timedelta, timezone

JST = timezone(timedelta(hours=9))


def jst_now() -> datetime:
    """Get current datetime in JST (naive, for DB storage)."""
    return datetime.now(JST).replace(tzinfo=None)


def jst_today() -> date:
    """Get today's date in JST."""
    return jst_now().date()


def jst_year() -> int:
    """Get current year in JST."""
    return jst_now().year
