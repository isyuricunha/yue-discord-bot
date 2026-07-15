import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@yuebot/database';
import { load_ai_fallback_settings } from './ai_fallback_settings.service';

test('load_ai_fallback_settings returns safe disabled default when row missing', async () => {
  const origFind = prisma.botSettings.findUnique;
  prisma.botSettings.findUnique = (async () => null) as any;

  try {
    const settings = await load_ai_fallback_settings();
    assert.deepEqual(settings, {
      discordAiTextFallbackEnabled: false,
      customProviderModel: null,
      customProviderReasoningMode: 'omit',
    });
  } finally {
    prisma.botSettings.findUnique = origFind;
  }
});

test('load_ai_fallback_settings fetches global key and normalizes values', async () => {
  let capturedArgs: any = null;
  const origFind = prisma.botSettings.findUnique;
  prisma.botSettings.findUnique = (async (args: any) => {
    capturedArgs = args;
    return {
      discordAiTextFallbackEnabled: true,
      customProviderModel: '  opaque/my-model  ',
      customProviderReasoningMode: 'high',
    };
  }) as any;

  try {
    const settings = await load_ai_fallback_settings();
    assert.equal(capturedArgs.where.id, 'global');
    assert.deepEqual(capturedArgs.select, {
      discordAiTextFallbackEnabled: true,
      customProviderModel: true,
      customProviderReasoningMode: true,
    });
    assert.deepEqual(settings, {
      discordAiTextFallbackEnabled: true,
      customProviderModel: 'opaque/my-model',
      customProviderReasoningMode: 'high',
    });
  } finally {
    prisma.botSettings.findUnique = origFind;
  }
});

test('load_ai_fallback_settings normalizes blank model to null and invalid reasoning to omit', async () => {
  const origFind = prisma.botSettings.findUnique;
  prisma.botSettings.findUnique = (async () => ({
    discordAiTextFallbackEnabled: true,
    customProviderModel: '   ',
    customProviderReasoningMode: 'invalid_mode',
  })) as any;

  try {
    const settings = await load_ai_fallback_settings();
    assert.deepEqual(settings, {
      discordAiTextFallbackEnabled: true,
      customProviderModel: null,
      customProviderReasoningMode: 'omit',
    });
  } finally {
    prisma.botSettings.findUnique = origFind;
  }
});

test('load_ai_fallback_settings handles database errors safely without throwing or exposing error message', async () => {
  const origFind = prisma.botSettings.findUnique;
  prisma.botSettings.findUnique = (async () => {
    throw new Error('FATAL_SECRET_DB_PASSWORD_EXPOSED_CONNECTION_FAILURE');
  }) as any;

  try {
    const settings = await load_ai_fallback_settings();
    assert.deepEqual(settings, {
      discordAiTextFallbackEnabled: false,
      customProviderModel: null,
      customProviderReasoningMode: 'omit',
    });
  } finally {
    prisma.botSettings.findUnique = origFind;
  }
});
