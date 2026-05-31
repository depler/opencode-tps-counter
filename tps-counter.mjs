import { appendFileSync, mkdirSync, existsSync } from "fs"
import { join } from "path"
import { homedir } from "os"

const LOG_DIR = join(homedir(), ".config", "opencode")
const LOG_FILE = join(LOG_DIR, "tps-counter.log")

if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })

try { appendFileSync(LOG_FILE, `[${new Date().toISOString()}] [init] plugin loaded\n`) } catch (e) {}

function log(msg) {
  appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`)
}

function fmtNum(n) {
  return n.toFixed(1)
}

export const TpsCounter = async (input = {}) => {
  const proj = input.directory || "?"
  const sessions = {}
  const partDurations = {}
  const pendingMsgs = {}

  function consumeMsgDuration(sessionId, msgId) {
    const prefix = `${sessionId}:${msgId}:`
    let total = 0
    for (const key of Object.keys(partDurations)) {
      if (key.startsWith(prefix)) {
        total += partDurations[key]
        delete partDurations[key]
      }
    }
    return total
  }

  function process(msg) {
    if (msg.role !== "assistant") return
    if (!msg.tokens?.output) return

    const output = msg.tokens.output
    if (output === 0) return

    const durMs = consumeMsgDuration(msg.sessionID, msg.id)

    if (!durMs) {
      pendingMsgs[`${msg.sessionID}:${msg.id}`] = msg
      return
    }

    const durationS = durMs / 1000
    if (durationS < 0.1) return

    const tps = output / durationS
    const sid = msg.sessionID

    if (!sessions[sid]) {
      sessions[sid] = { tokens: 0, time: 0, count: 0 }
    }
    sessions[sid].tokens += output
    sessions[sid].time += durMs
    sessions[sid].count += 1

    const s = sessions[sid]
    const avgTps = s.tokens / (s.time / 1000)
    const model = msg.modelID || "?"

    log(`[msg] ${model} | TPS: ${fmtNum(tps)} | tokens: ${output} | duration: ${fmtNum(durationS)}s`)
    log(`[session] ${sid} | avg TPS: ${fmtNum(avgTps)} | total tokens: ${s.tokens} | time: ${fmtNum(s.time / 1000)}s | msgs: ${s.count}`)
  }

  function cleanupSession(sid) {
    for (const key of Object.keys(partDurations)) {
      if (key.startsWith(`${sid}:`)) delete partDurations[key]
    }
    for (const key of Object.keys(pendingMsgs)) {
      if (key.startsWith(`${sid}:`)) delete pendingMsgs[key]
    }
  }

  try { appendFileSync(LOG_FILE, `[${new Date().toISOString()}] [init] TpsCounter initialized | project: ${proj}\n`) } catch (e) {}

  return {
    event: async ({ event }) => {
      if (event.type === "message.part.updated") {
        const part = event.properties?.part
        if (part?.type !== "text") return
        if (!part.time?.start || !part.time?.end) return

        const partKey = `${part.sessionID}:${part.messageID}:${part.id}`
        partDurations[partKey] = part.time.end - part.time.start

        const msgKey = `${part.sessionID}:${part.messageID}`
        const pending = pendingMsgs[msgKey]
        if (pending) {
          delete pendingMsgs[msgKey]
          process(pending)
        }
      }

      if (event.type === "message.updated") {
        const msg = event.properties?.info
        if (!msg || msg.role !== "assistant") return
        process(msg)
      }

      if (event.type === "session.deleted") {
        const sid = event.properties?.info?.id
        if (sid) cleanupSession(sid)
      }
    },
  }
}
