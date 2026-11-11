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
