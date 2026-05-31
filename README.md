# opencode-tps-counter

Logs per-message and session-average tokens per second (TPS) to `~/.config/opencode/tps-counter.log`.

Works with both **TUI** and **Desktop GUI** (uses core `event` hook).

## How it works

- Listens to `message.part.updated` for text parts — stores `part.time.end - part.time.start` per `sessionID:messageID:partID`
- Listens to `message.updated` for assistant messages — grabs `msg.tokens.output`
- TPS = output_tokens / sum of all part durations for that message
- Parts with total duration under **0.1s** are skipped (noise filter)
- Non-assistant messages and messages with zero output tokens are ignored
- Session average is a running mean: `total_output_tokens / total_generation_time` across all messages
- Multiple simultaneous sessions tracked independently by `sessionID`
- On `session.deleted` all stored data for that session is cleaned up
- All writes are synchronous (`appendFileSync` — no buffering) so external readers see data in real time

## Log format

```
[2026-05-31T10:23:45.123Z] [init] plugin loaded
[2026-05-31T10:23:45.123Z] [init] TpsCounter initialized | project: /home/user/my-project
[2026-05-31T10:23:45.123Z] [msg] deepseek-v4-flash | TPS: 87.3 | tokens: 452 | duration: 5.2s
[2026-05-31T10:23:45.123Z] [session] abc123 | avg TPS: 91.2 | total tokens: 2150 | time: 23.6s | msgs: 4
```

## Install

### Via git URL (recommended)

Add to the `"plugin"` array in `~/.config/opencode/opencode.json`:

```jsonc
{
  "plugin": [
    "tps-counter@git+https://github.com/depler/opencode-tps-counter.git"
  ]
}
```

Restart opencode.

### Via local file

```bash
mkdir -p ~/.config/opencode/plugins
cp tps-counter.mjs ~/.config/opencode/plugins/
```

Add to `~/.config/opencode/opencode.json`:

```jsonc
{
  "plugin": [
    "file:///home/USER/.config/opencode/plugins/tps-counter.mjs"
  ]
}
```

Replace `USER` with your actual username. Restart opencode.

