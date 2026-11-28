import { ExtensionContext } from "vscode";

/**
 * An extension context with an in-memory global state and without subscriptions.
 * Passing the same state to several contexts simulates a restart or another workspace.
 */
export function createExtensionContextStub(
    globalState = new Map<string, unknown>(),
) {
    return {
        subscriptions: [],
        globalState: {
            get: (key: string) => globalState.get(key),
            update: async (key: string, value: unknown) => {
                globalState.set(key, value);
            },
        },
    } as unknown as ExtensionContext;
}
