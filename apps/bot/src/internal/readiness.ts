export type bot_readiness_result = {
  statusCode: 200 | 503
  body: {
    status: 'ready' | 'not_ready'
    clientReady: boolean
  }
}

export function get_bot_readiness(client: { isReady(): boolean }): bot_readiness_result {
  const client_ready = client.isReady()

  return {
    statusCode: client_ready ? 200 : 503,
    body: {
      status: client_ready ? 'ready' : 'not_ready',
      clientReady: client_ready,
    },
  }
}
