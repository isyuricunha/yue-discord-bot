import type { FastifyInstance } from 'fastify'

export function validation_error_details(
  fastify: FastifyInstance,
  error: { flatten: () => unknown },
): unknown | undefined {
  if (fastify.config?.environment !== 'development') return undefined
  return error.flatten()
}
