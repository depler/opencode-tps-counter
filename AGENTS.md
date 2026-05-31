## IMPORTANT

- **NEVER commit or push changes automatically** — only when explicitly asked
- Plugin installed viagit URL (`tps-counter@git+https://...`); after modifying `tps-counter.mjs` in this repo, commit, push, then restart opencode — it pulls from GitHub
- For local development: `cp tps-counter.mjs ~/.config/opencode/plugins/` and switch config to `file://` path
- Plugin file: `tps-counter.mjs` — single-file ESM module
- Requires `package.json` with `"main": "tps-counter.mjs"` and `"type": "module"` — opencode uses the `main` field to resolve the entry point for git-installed plugins
- Works with both TUI and Desktop GUI (uses core `event` hook)
- Plugin function receives `input` (PluginInput) with `project`, `directory`, etc.; `project.name` is logged in `[init]` line for multi-project disambiguation

## Plugin logic

Logs three types of lines to `~/.config/opencode/tps-counter.log`:
- `[init]` — plugin loaded / counter initialized
- `[msg]` — per-message TPS
- `[session]` — running session average TPS

**Per-message TPS** — `[msg]`
- Listens to `message.part.updated` for text parts — stores `part.time.end - part.time.start` per `sessionID:messageID:partID` (last write wins for the same part)
- Token count from `message.updated` → `msg.tokens.output`
- TPS = output_tokens / sum of all part durations for that message
- Durations under **0.1s total** are skipped as noise
- Non-assistant messages and messages with zero/null output tokens are ignored
- Race-condition safe: if `message.updated` arrives before any `message.part.updated`, the msg is held in `pendingMsgs` until the first part arrives

**Session average TPS** — `[session]`
- Updated after each message in the session (running average)
- Running avg = total_output_tokens / total_generation_time across all messages
- Session data persists in memory (never deleted)
- Multiple simultaneous sessions tracked independently by `sessionID`

**Cleanup:** on `session.deleted` all `partDurations` and `pendingMsgs` entries for that session are removed.

**Logging:** immediate — each `[init]`, `[msg]`, and `[session]` line is written to disk synchronously via `appendFileSync` (no buffering). This ensures external readers (e.g. Python scripts that parse the log) always see the latest data in real time.

**Memory:** no unbounded growth — `partDurations` entries are deleted after the message is processed; `pendingMsgs` is self-cleaning.

## Event flow

```
init                                        →  log [init] plugin loaded
init (TpsCounter initialized)               →  log [init] TpsCounter initialized | project: <name>
message.part.updated (text, with time.end)  →  store duration by sessionID:messageID:partID
                                               →  if msg pending → process it
message.updated (assistant, with tokens)    →  if role!=assistant / no tokens / zero tokens → skip
                                               →  consume & delete all part durations for that msg
                                               →  if no parts yet → store msg as pending
                                               →  if total duration < 0.1s → skip (noise filter)
                                               →  log [msg] TPS + [session] updated average
session.deleted                              →  cleanup all stored data for that session
```

## Install

### Via git URL (recommended)

Add to `"plugin"` array in `~/.config/opencode/opencode.json`:
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

## Watch live

```bash
tail -f ~/.config/opencode/tps-counter.log
```
