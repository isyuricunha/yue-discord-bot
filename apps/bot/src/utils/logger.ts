import pino from 'pino';
import { CONFIG } from '../config';

const pretty_transport = CONFIG.logFormat === 'pretty'
  ? {
      target: 'pino-pretty',
      options: {
        colorize: Boolean(process.stdout.isTTY),
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'pid,hostname',
        messageFormat: '{msg}',
      },
    }
  : undefined;

export const logger = pino({
  level: CONFIG.logLevel,
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
  transport: pretty_transport,
});
