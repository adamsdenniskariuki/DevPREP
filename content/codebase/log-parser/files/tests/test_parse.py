from logs.parse import parse_line


def test_parses_a_simple_line():
    assert parse_line("2026-03-04T09:30:00 ERROR timeout") == {
        "time": "2026-03-04T09:30:00",
        "level": "ERROR",
        "message": "timeout",
    }


def test_level_is_case_insensitive():
    assert parse_line("2026-03-04T09:30:00 warn slow")["level"] == "WARN"


def test_ignores_noise():
    assert parse_line("") is None
    assert parse_line("--- restarted ---") is None
    assert parse_line("2026-03-04T09:30:00 LOUD hello") is None
