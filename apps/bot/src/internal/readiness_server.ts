import http from 'node:http'

import type { Client } from 'discord.js'

import { get_bot_readiness } from './readiness'
import { logger } from '../utils/logger'

type readiness_server_options = {
  host: string
  port: number
  secret: string
}

function send_json(reply: http.ServerResponse, status_code: number, body: unknown) {
  const payload = JSON.stringify(body)
  reply.statusCode = status_code
  reply.setHeader('content-type', 'application/json; charset=utf-8')
  reply.setHeader('content-length', Buffer.byteLength(payload))
  reply.end(payload)
}

export function start_bot_readiness_server(client: Client, options: readiness_server_options) {
  const server = http.createServer((req, res) => {
    if (req.headers.authorization !== `Bearer ${options.secret}`) {
      return send_json(res, 401, { error: 'Unauthorized' })
    }

    const url = new URL(req.url ?? '/', 'http://localhost')
    if (req.method !== 'GET' || url.pathname !== '/internal/ready') {
      return send_json(res, 404, { error: 'Not found' })
    }

    const readiness = get_bot_readiness(client)
    return send_json(res, readiness.statusCode, readiness.body)
  })

  server.listen(options.port, options.host, () => {
    logger.info(`💓 Bot readiness listening on http://${options.host}:${options.port}`)
  })

  return server
}
