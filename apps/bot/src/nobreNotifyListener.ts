import { readFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { Client as PgClient } from 'pg'
import { logger } from './utils/logger'
import { safe_error_details } from './utils/safe_error'

// Transactional LISTEN/NOTIFY is only a wakeup mechanism. The API and
// database remain authoritative. A five-minute timer remains the fallback.
const exec = promisify(execFile)
const siteChannel = 'vb_nobre_site_changed'
const yueChannel = 'vb_nobre_yue_changed'
const targetUnit = 'vb-nobre-rest-worker.service'
const guildId = process.env.VB_SHARED_NOBRE_GUILD_ID

function siteDatabaseUrl() {
  const path = '/home/ubuntu/.config/vai-brasil/api.env'
  const line = readFileSync(path, 'utf8').split(/\r?\n/).find(v => v.startsWith('DATABASE_URL='))
  if (!line) throw new Error('site_database_not_configured')
  let value = line.substring('DATABASE_URL='.length).trim()
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
  if (!/^postgres(?:ql)?:\/\//.test(value)) throw new Error('site_database_invalid')
  return value
}

let pending = false
let draining = false
let shuttingDown = false
let drainTimer: ReturnType<typeof setTimeout> | undefined
let nativeFollowUp: ReturnType<typeof setTimeout> | undefined
let nativeSnapshotTimer: ReturnType<typeof setTimeout> | undefined
const clients = new Set<PgClient>()

function wake(reason: 'site' | 'yue' | 'reconnect') {
  if (shuttingDown) return
  pending = true
  // The older Discord gateway may remove an expired native role shortly
  // after its DB transaction. Recheck after its outbox has had time to run.
  if (reason === 'yue' && !nativeSnapshotTimer) {
    nativeSnapshotTimer = setTimeout(() => {
      nativeSnapshotTimer = undefined
      void exec('systemctl', ['--user', 'start', 'vai-brasil-nobre-native-snapshot.service'],
        { timeout: 60000 }).catch(() => {
          logger.warn('Nobre administrative snapshot refresh deferred')
        })
    }, 1000)
    nativeSnapshotTimer.unref()
  }
  if (reason === 'yue' && !nativeFollowUp) {
    nativeFollowUp = setTimeout(() => {
      nativeFollowUp = undefined
      wake('reconnect')
    }, 30000)
    nativeFollowUp.unref()
  }
  if (!draining && !drainTimer) {
    drainTimer = setTimeout(() => {
      drainTimer = undefined
      void drain().catch(error => {
        logger.warn({ err: safe_error_details(error) }, 'Nobre live dispatch deferred')
        if (!shuttingDown) {
          pending = true
          setTimeout(() => wake('reconnect'), 10000).unref()
        }
      })
    }, 750)
  }
  logger.debug({ source: reason }, 'Nobre reconciliation wakeup')
}

async function drain() {
  if (draining || shuttingDown) return
  draining = true
  try {
    while (pending && !shuttingDown) {
      pending = false
      try {
        await exec('systemctl', ['--user', 'start', targetUnit], {
          timeout: 180000, windowsHide: true
        })
      } catch (error) {
        pending = true
        logger.warn({ err: safe_error_details(error) }, 'Nobre live worker unavailable')
        await new Promise(resolve => setTimeout(resolve, 15000))
      }
    }
  } finally {
    draining = false
    if (pending && !shuttingDown) wake('reconnect')
  }
}

function listen(connectionString: string, channel: string, source: 'site' | 'yue') {
  let delay = 2000
  const connect = async () => {
    if (shuttingDown) return
    const client = new PgClient({ connectionString, connectionTimeoutMillis: 10000, keepAlive: true })
    clients.add(client)
    let retired = false
    const retire = () => {
      if (retired) return
      retired = true
      clients.delete(client)
      void client.end().catch(() => {})
      if (!shuttingDown) {
        const pause = delay
        delay = Math.min(delay * 2, 30000)
        setTimeout(() => void connect(), pause).unref()
      }
    }
    client.on('error', () => {
      logger.warn({ source }, 'Nobre database notification connection lost')
      retire()
    })
    client.on('end', retire)
    client.on('notification', message => {
      if (message.channel !== channel) return
      if (source === 'yue' && message.payload !== guildId) return
      wake(source)
    })
    try {
      await client.connect()
      await client.query('LISTEN ' + channel)
      delay = 2000
      logger.info({ source }, 'Nobre live notifications connected')
      wake('reconnect') // catch up on notifications missed while disconnected
    } catch {
      logger.warn({ source }, 'Nobre live notification subscription unavailable')
      retire()
    }
  }
  void connect()
}

async function main() {
  if (process.env.VB_SHARED_NOBRE_LISTENER_ENABLED !== '1')
    throw new Error('nobre_listener_disabled')
  if (!guildId || !/^[0-9]{16,22}$/.test(guildId))
    throw new Error('nobre_guild_invalid')
  const botUrl = process.env.DATABASE_URL
  if (!botUrl) throw new Error('bot_database_missing')
  listen(siteDatabaseUrl(), siteChannel, 'site')
  listen(botUrl, yueChannel, 'yue')
  const shutdown = () => {
    shuttingDown = true
    if (drainTimer) clearTimeout(drainTimer)
    if (nativeFollowUp) clearTimeout(nativeFollowUp)
    if (nativeSnapshotTimer) clearTimeout(nativeSnapshotTimer)
    for (const client of clients) void client.end().catch(() => {})
    setTimeout(() => process.exit(0), 500).unref()
  }
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}

void main().catch(error => {
  logger.error({ err: safe_error_details(error) }, 'Nobre live listener failed to start')
  process.exitCode = 1
})
