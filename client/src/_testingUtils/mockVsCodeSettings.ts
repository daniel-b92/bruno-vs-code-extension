import { jest } from "@jest/globals";
import { workspace } from "vscode";

/**
 * Makes the VS Code settings return the given values (keys are the full setting names, e.g. `bru-as-code.sequenceStep`) and `undefined` for all others.
 * Tests that use this need to call `jest.restoreAllMocks()` afterwards.
 */
export function mockVsCodeSettings(settings: Record<string, unknown>) {
    jest.spyOn(workspace, "getConfiguration").mockReturnValue({
        get: (key: string) => settings[key],
    } as never);
}
