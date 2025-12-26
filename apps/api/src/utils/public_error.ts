import type { FastifyInstance } from 'fastify'

export function public_error_message(
  fastify: FastifyInstance,
  message: string,
  public_message = 'Internal server error',
): string {
  if (fastify.config?.environment === 'development') return message
  return public_message
}
