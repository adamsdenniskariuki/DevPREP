from logs.parse import parse_line
from logs.summary import top_messages


def test_multi_word_message_is_kept():
    entry = parse_line("2026-03-04T09:30:00 ERROR could not reach payments")
    assert entry["message"] == "could not reach payments"


def test_different_messages_with_same_first_word_stay_apart():
    lines = [
        "2026-03-04T09:00:00 ERROR disk full on /var",
        "2026-03-04T09:01:00 ERROR disk full on /var",
        "2026-03-04T09:02:00 ERROR disk slow on /home",
    ]
    assert top_messages(lines) == [("disk full on /var", 2), ("disk slow on /home", 1)]


def test_short_lines_are_still_ignored():
    assert parse_line("2026-03-04T09:30:00 ERROR") is None
