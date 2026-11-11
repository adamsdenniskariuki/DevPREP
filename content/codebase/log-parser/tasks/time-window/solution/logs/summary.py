"""Dashboard numbers built from many log lines."""
from collections import Counter

from logs.parse import parse_all


def count_by_level(lines):
    counts = Counter(entry["level"] for entry in parse_all(lines))
    return dict(sorted(counts.items()))


def top_messages(lines, n=3, level="ERROR"):
    """The n most common messages at a level, most common first, ties alphabetical."""
    counts = Counter(entry["message"] for entry in parse_all(lines) if entry["level"] == level)
    return sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:n]


def between(lines, start, end):
    """Entries with start <= time < end, in log order. Times are ISO strings, so they compare as text."""
    if end < start:
        raise ValueError("end must not be before start")
    return [entry for entry in parse_all(lines) if start <= entry["time"] < end]
