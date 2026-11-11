# Logscan

Reads plain-text service logs and summarises them for an on-call dashboard.

A log line looks like this:

```
2026-03-04T09:30:00 ERROR disk full on /var
```

That is an ISO time, a level (DEBUG, INFO, WARN or ERROR) and a free-text message. Anything else is ignored.

## Layout

- `logs/parse.py` turns one line into a dict, or None if the line is not a log entry.
- `logs/summary.py` builds the dashboard numbers from many lines.
- `tests/` has the suite. Every `test_*` function in a `tests/test_*.py` file is run.
