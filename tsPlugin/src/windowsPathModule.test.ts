import { describe, it, expect, jest } from "@jest/globals";
import { sep } from "path";
import {
    createLanguageServiceWithPlugin,
    createPlugin,
    getDiagnosticTexts,
    writeFile,
} from "./_testingUtils";

// The plugin uses the `path` module of the platform it runs on, so on Windows its functions behave like `path.win32`.
jest.mock(
    "path",
    () => jest.requireActual<typeof import("path")>("path").win32,
);

describe("with the path functions of Windows", () => {
    const brunoJson = "c:/collection/bruno.json";

    it("uses the path functions of Windows", () => {
        expect(sep).toBe("\\");
    });

    it("detects the collection of a request in a nested folder", () => {
        const requestFile = "c:/collection/requests/users/request.bru";
        const content = "script:pre-request {\n  bru.missing();\n}\n";

        expect(
            getDiagnosticTexts(
                createWindowsLanguageService({
                    [brunoJson]: '{ "type": "collection" }',
                    [requestFile]: content,
                }),
                requestFile,
                content,
            ),
        ).toEqual([{ code: 2_339, text: "missing" }]);
    });

    it("does not find a collection above the drive root", () => {
        const requestFile = "c:/other/request.bru";
        const content = "script:pre-request {\n  bru.missing();\n}\n";

        expect(
            getDiagnosticTexts(
                createWindowsLanguageService({
                    "c:/bruno.json": '{ "type": "other" }',
                    [requestFile]: content,
                }),
                requestFile,
                content,
            ),
        ).toEqual([]);
    });

    it("detects a collection whose root file is created later", () => {
        const requestFile = "c:/collection/request.bru";
        const content = "script:pre-request {\n  bru.missing();\n}\n";
        const files: Record<string, string> = { [requestFile]: content };
        const languageService = createWindowsLanguageService(files);

        expect(
            getDiagnosticTexts(languageService, requestFile, content),
        ).toEqual([]);

        writeFile(files, brunoJson, '{ "type": "collection" }');

        expect(
            getDiagnosticTexts(languageService, requestFile, content),
        ).toEqual([{ code: 2_339, text: "missing" }]);
    });
});

function createWindowsLanguageService(files: Record<string, string>) {
    return createLanguageServiceWithPlugin(
        files,
        createPlugin({ yamlCollectionSupport: true }),
        undefined,
        {
            currentDirectory: "c:/collection",
            useCaseSensitiveFileNames: false,
        },
    );
}
