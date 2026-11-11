"""Parse lines like '2026-03-04T09:30:00 ERROR disk full on /var'."""

LEVELS = ("DEBUG", "INFO", "WARN", "ERROR")


def parse_line(line):
    """Return {'time', 'level', 'message'} or None for a line that is not a log entry."""
    parts = line.strip().split()
    if len(parts) < 3:
        return None
    time, level, message = parts[0], parts[1], parts[2]
    level = level.upper()
    if level not in LEVELS or "T" not in time:
        return None
    return {"time": time, "level": level, "message": message.strip()}


def parse_all(lines):
    return [entry for entry in map(parse_line, lines) if entry is not None]
