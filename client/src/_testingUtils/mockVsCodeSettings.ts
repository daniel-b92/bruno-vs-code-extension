import { jest } from "@jest/globals";
import { workspace } from "vscode";

/**
 * Makes the VS Code settings return the given values (keys are the full setting names, e.g. `bru-as-code.sequenceStep`) and `undefined` for all others.
 * The values are reported as set globally by `inspect`. An optional `update` mock can be passed to track written settings.
 * Tests that use this need to call `jest.restoreAllMocks()` afterwards.
 */
export function mockVsCodeSettings(
    settings: Record<string, unknown>,
    update: (...args: unknown[]) => Promise<void> = () => Promise.resolve(),
) {
    jest.spyOn(workspace, "getConfiguration").mockReturnValue({
        get: (key: string) => settings[key],
        inspect: (key: string) => ({ key, globalValue: settings[key] }),
        update,
    } as never);
}
