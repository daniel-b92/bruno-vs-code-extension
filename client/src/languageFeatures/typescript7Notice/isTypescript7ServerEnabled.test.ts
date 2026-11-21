import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { extensions } from "vscode";
import { mockVsCodeSettings } from "../../_testingUtils";
import { isTypescript7ServerEnabled } from "./isTypescript7ServerEnabled";

describe("isTypescript7ServerEnabled", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it.each(["js/ts.experimental.useTsgo", "typescript.experimental.useTsgo"])(
        "is enabled if %p is set and the Typescript 7 extension is installed",
        (key) => {
            mockVsCodeSettings({ [key]: true });
            mockInstalledExtensions(["typescriptteam.native-preview"]);

            expect(isTypescript7ServerEnabled()).toBe(true);
        },
    );

    it("is disabled by default", () => {
        mockVsCodeSettings({});
        mockInstalledExtensions(["typescriptteam.native-preview"]);

        expect(isTypescript7ServerEnabled()).toBe(false);
    });

    it("is disabled if the setting is `false`", () => {
        mockVsCodeSettings({ "js/ts.experimental.useTsgo": false });
        mockInstalledExtensions(["typescriptteam.native-preview"]);

        expect(isTypescript7ServerEnabled()).toBe(false);
    });

    it("prefers an explicit unified setting over the legacy one", () => {
        mockVsCodeSettings({
            "js/ts.experimental.useTsgo": false,
            "typescript.experimental.useTsgo": true,
        });
        mockInstalledExtensions(["typescriptteam.native-preview"]);

        expect(isTypescript7ServerEnabled()).toBe(false);
    });

    it("is disabled if the Typescript 7 extension is not installed", () => {
        mockVsCodeSettings({ "js/ts.experimental.useTsgo": true });
        mockInstalledExtensions([]);

        expect(isTypescript7ServerEnabled()).toBe(false);
    });
});

function mockInstalledExtensions(ids: string[]) {
    jest.spyOn(extensions, "getExtension").mockImplementation((id: string) =>
        ids.includes(id.toLowerCase()) ? ({} as never) : undefined,
    );
}
