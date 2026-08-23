import { CONFIG } from './config'
import { client } from './index'
import { start_bot_readiness_server } from './internal/readiness_server'

start_bot_readiness_server(client, {
  host: CONFIG.readiness.host,
  port: CONFIG.readiness.port,
  secret: CONFIG.internalApi.secret,
})
