import { safe_error_details } from '../utils/safe_error';
import type { ApiRuntime } from './create_api_runtime';

type process_like = Pick<NodeJS.Process, 'once' | 'on' | 'exit'>;

export type runtime_terminator = (
  reason: string,
  exit_code: number,
  error?: unknown
) => void;

export function install_process_handlers(
  runtime: ApiRuntime,
  target: process_like = process
): runtime_terminator {
  let terminating = false;

  const terminate: runtime_terminator = (reason, exit_code, error) => {
    if (terminating) return;
    terminating = true;

    if (error !== undefined) {
      runtime.app.log.error(
        { err: safe_error_details(error), reason },
        'Fatal API process error'
      );
    }

    void runtime.shutdown(reason)
      .catch((shutdown_error) => {
        runtime.app.log.error(
          { err: safe_error_details(shutdown_error) },
          'API shutdown failed'
        );
      })
      .finally(() => {
        target.exit(exit_code);
      });
  };

  target.once('SIGINT', () => terminate('SIGINT', 0));
  target.once('SIGTERM', () => terminate('SIGTERM', 0));

  target.on('unhandledRejection', (error) => {
    terminate('unhandledRejection', 1, error);
  });

  target.on('uncaughtException', (error) => {
    terminate('uncaughtException', 1, error);
  });

  return terminate;
}
