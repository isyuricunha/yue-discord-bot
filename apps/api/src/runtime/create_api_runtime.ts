import type { FastifyInstance } from 'fastify';
import type Redis from 'ioredis';
import { prisma } from '@yuebot/database';
import { assert_api_runtime_env, CONFIG } from '../config';
import { safe_error_details } from '../utils/safe_error';
import { createApiApp, type ApiAppResources } from './create_api_app';

type redis_resource = Pick<Redis, 'disconnect'>;

type api_app_resources = Omit<ApiAppResources, 'redis_client'> & {
  redis_client?: redis_resource;
};

type runtime_dependencies = {
  create_app?: () => api_app_resources;
  disconnect_database?: () => Promise<void>;
  validate_env?: () => void;
};

export type ApiRuntime = {
  app: FastifyInstance;
  start: () => Promise<void>;
  shutdown: (reason: string) => Promise<void>;
};

export function createApiRuntime(dependencies: runtime_dependencies = {}): ApiRuntime {
  const create_app = dependencies.create_app ?? createApiApp;
  const disconnect_database = dependencies.disconnect_database ?? (() => prisma.$disconnect());
  const validate_env = dependencies.validate_env ?? (() => assert_api_runtime_env());
  const { app, redis_client } = create_app();

  let start_promise: Promise<void> | undefined;
  let shutdown_promise: Promise<void> | undefined;

  const start = (): Promise<void> => {
    if (shutdown_promise) {
      return Promise.reject(new Error('Cannot start API runtime after shutdown has begun'));
    }

    if (start_promise) return start_promise;

    start_promise = (async () => {
      validate_env();
      await app.listen({ port: CONFIG.api.port, host: CONFIG.api.host });
      app.log.info(`API listening on http://${CONFIG.api.host}:${CONFIG.api.port}`);

      if (CONFIG.environment === 'development') {
        app.log.info('Registered routes:');
        app.log.info(app.printRoutes());
      }
    })();

    return start_promise;
  };

  const shutdown = (reason: string): Promise<void> => {
    if (shutdown_promise) return shutdown_promise;

    shutdown_promise = (async () => {
      app.log.info({ reason }, 'Shutting down API');
      await start_promise?.catch(() => undefined);

      const failures: unknown[] = [];

      const stop_resource = async (name: string, stop: () => void | Promise<void>) => {
        try {
          await stop();
        } catch (error: unknown) {
          failures.push(error);
          app.log.error(
            { err: safe_error_details(error), resource: name },
            'Failed to stop API resource'
          );
        }
      };

      await stop_resource('fastify', () => app.close());

      if (redis_client) {
        await stop_resource('rate-limit redis', () => redis_client.disconnect());
      }

      await stop_resource('database', disconnect_database);

      if (failures.length > 0) {
        throw new AggregateError(failures, 'API shutdown completed with errors');
      }
    })();

    return shutdown_promise;
  };

  return { app, start, shutdown };
}
