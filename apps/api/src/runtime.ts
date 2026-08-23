import { createApiRuntime } from './runtime/create_api_runtime';
import { install_process_handlers } from './runtime/process_handlers';

const api_runtime = createApiRuntime();
const terminate = install_process_handlers(api_runtime);

void api_runtime.start().catch((error) => {
  terminate('startupFailure', 1, error);
});
