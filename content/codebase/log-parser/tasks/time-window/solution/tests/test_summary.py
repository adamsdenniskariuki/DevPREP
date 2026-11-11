from logs.summary import between, count_by_level, top_messages

LINES = [
    "2026-03-04T09:00:00 INFO started",
    "2026-03-04T09:01:00 ERROR timeout",
    "garbage",
    "2026-03-04T09:02:00 ERROR timeout",
    "2026-03-04T09:03:00 ERROR refused",
]


def test_counts_levels():
    assert count_by_level(LINES) == {"ERROR": 3, "INFO": 1}


def test_top_messages():
    assert top_messages(LINES, n=1) == [("timeout", 2)]


def test_between_is_start_inclusive_end_exclusive():
    found = between(LINES, "2026-03-04T09:01:00", "2026-03-04T09:03:00")
    assert [entry["time"] for entry in found] == ["2026-03-04T09:01:00", "2026-03-04T09:02:00"]
