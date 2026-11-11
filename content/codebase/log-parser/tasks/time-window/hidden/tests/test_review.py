from logs.summary import between

LINES = [
    "2026-03-04T08:59:59 INFO warming up",
    "2026-03-04T09:00:00 INFO started",
    "not a log line",
    "2026-03-04T09:30:00 WARN slow",
    "2026-03-04T10:00:00 ERROR timeout",
]


def test_window_keeps_log_order_and_skips_noise():
    found = between(LINES, "2026-03-04T09:00:00", "2026-03-04T10:00:00")
    assert [entry["message"] for entry in found] == ["started", "slow"]


def test_empty_window():
    assert between(LINES, "2026-03-04T09:00:00", "2026-03-04T09:00:00") == []


def test_window_covering_everything():
    assert len(between(LINES, "2026-03-04T00:00:00", "2026-03-05T00:00:00")) == 4


def test_backwards_window_is_rejected():
    try:
        between(LINES, "2026-03-04T10:00:00", "2026-03-04T09:00:00")
    except ValueError:
        return
    raise AssertionError("expected ValueError")
