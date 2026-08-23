import test from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';

import { createApiRuntime } from './create_api_runtime';

function fake_app(
  events: string[],
  options: { listen_error?: Error; close_error?: Error } = {}
): FastifyInstance {
  return {
    listen: async () => {
      events.push('listen');
      if (options.listen_error) throw options.listen_error;
      return 'http://127.0.0.1:3000';
    },
    close: async () => {
      events.push('close');
      if (options.close_error) throw options.close_error;
    },
    printRoutes: () => 'routes',
    log: {
      info: () => undefined,
      error: () => undefined,
    },
  } as unknown as FastifyInstance;
}

test('starts once and shuts resources down once in dependency order', async () => {
  const events: string[] = [];
  const app = fake_app(events);

  const runtime = createApiRuntime({
    validate_env: () => events.push('validate'),
    create_app: () => ({
      app,
      redis_client: {
        disconnect: () => events.push('redis'),
      },
    }),
    disconnect_database: async () => {
      events.push('database');
    },
  });

  await Promise.all([runtime.start(), runtime.start()]);
  await Promise.all([runtime.shutdown('SIGTERM'), runtime.shutdown('SIGINT')]);
  await runtime.shutdown('SIGTERM');

  assert.deepEqual(events, [
    'validate',
    'listen',
    'close',
    'redis',
    'database',
  ]);
});

test('shutdown keeps closing remaining resources after a stop failure', async () => {
  const events: string[] = [];
  const close_error = new Error('close failed');
  const app = fake_app(events, { close_error });

  const runtime = createApiRuntime({
    validate_env: () => undefined,
    create_app: () => ({
      app,
      redis_client: {
        disconnect: () => events.push('redis'),
      },
    }),
    disconnect_database: async () => {
      events.push('database');
    },
  });

  await runtime.start();
  await assert.rejects(runtime.shutdown('SIGTERM'), (error: unknown) => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [close_error]);
    return true;
  });

  assert.deepEqual(events, ['listen', 'close', 'redis', 'database']);
});

test('startup failure can be followed by a complete graceful shutdown', async () => {
  const events: string[] = [];
  const listen_error = new Error('listen failed');
  const app = fake_app(events, { listen_error });

  const runtime = createApiRuntime({
    validate_env: () => events.push('validate'),
    create_app: () => ({
      app,
      redis_client: {
        disconnect: () => events.push('redis'),
      },
    }),
    disconnect_database: async () => {
      events.push('database');
    },
  });

  await assert.rejects(runtime.start(), listen_error);
  await runtime.shutdown('startupFailure');

  assert.deepEqual(events, [
    'validate',
    'listen',
    'close',
    'redis',
    'database',
  ]);
});

test('runtime cannot start after shutdown has begun', async () => {
  const events: string[] = [];
  const app = fake_app(events);

  const runtime = createApiRuntime({
    validate_env: () => events.push('validate'),
    create_app: () => ({ app }),
    disconnect_database: async () => {
      events.push('database');
    },
  });

  await runtime.shutdown('SIGTERM');
  await assert.rejects(runtime.start(), /Cannot start API runtime after shutdown has begun/);

  assert.deepEqual(events, ['close', 'database']);
});
