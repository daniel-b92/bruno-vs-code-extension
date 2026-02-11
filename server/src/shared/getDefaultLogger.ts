import { Logger } from "@global_shared";

export function getDefaultLogger(): Logger {
    return { ...console, dispose: () => {} };
}
