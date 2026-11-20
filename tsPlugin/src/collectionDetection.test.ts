import { describe, it, expect, beforeEach } from "@jest/globals";
import {
    createLanguageServiceWithPlugin,
    directoryWatchers,
    fileWatchers,
    getDiagnosticCodes,
    helperModule,
    readDirectories,
    resetWatchers,
    writeFile,
} from "./_testingUtils";

beforeEach(resetWatchers);

describe("detection of collections", () => {
    describe.each([
        {
            format: "bru",
            collectionRootFile: "bruno.json",
            collectionRootFileContent: '{ "type": "collection" }',
            invalidRootFileContent: '{ "type": "other" }',
            requestFile: "users/get-user.bru",
            // Missing runtime objects are not reported, so the file just has no types.
            diagnosticCodesWithoutCollection: [],
            createRequestFileContent: (code: string) =>
                `meta {\n  name: request\n}\n\nscript:pre-request {\n  ${code}\n}\n`,
        },
        {
            format: "yaml",
            collectionRootFile: "opencollection.yml",
            collectionRootFileContent: "opencollection: 1.0.0\n",
            invalidRootFileContent: "info:\n  name: other\n",
            requestFile: "users/get-user.yml",
            // Yaml files outside of collections are masked completely.
            diagnosticCodesWithoutCollection: [],
            createRequestFileContent: (code: string) =>
                `info:\n  name: request\nruntime:\n  scripts:\n    - type: before-request\n      code: |-\n        ${code}\n`,
        },
    ])(
        "for $format files",
        ({
            collectionRootFile,
            collectionRootFileContent,
            invalidRootFileContent,
            requestFile,
            diagnosticCodesWithoutCollection,
            createRequestFileContent,
        }) => {
            const absoluteRequestFile = `/collection/${requestFile}`;
            const absoluteRootFile = `/collection/${collectionRootFile}`;
            const requestFileContent =
                createRequestFileContent("bru.missing();");
            // Property 'missing' does not exist on the type of 'bru'.
            const diagnosticCodesWithinCollection = [2_339];

            it("provides the runtime types after the root file of the collection has been created", () => {
                const files = { [absoluteRequestFile]: requestFileContent };
                const languageService = createLanguageServiceWithPlugin(files);

                expect(
                    getDiagnosticCodes(languageService, absoluteRequestFile),
                ).toEqual(diagnosticCodesWithoutCollection);

                writeFile(files, absoluteRootFile, collectionRootFileContent);

                expect(
                    getDiagnosticCodes(languageService, absoluteRequestFile),
                ).toEqual(diagnosticCodesWithinCollection);
            });

            it("provides the runtime types after the root file of the collection has been fixed", () => {
                const files = {
                    [absoluteRootFile]: invalidRootFileContent,
                    [absoluteRequestFile]: requestFileContent,
                };
                const languageService = createLanguageServiceWithPlugin(files);

                expect(
                    getDiagnosticCodes(languageService, absoluteRequestFile),
                ).toEqual(diagnosticCodesWithoutCollection);

                writeFile(files, absoluteRootFile, collectionRootFileContent);

                expect(
                    getDiagnosticCodes(languageService, absoluteRequestFile),
                ).toEqual(diagnosticCodesWithinCollection);
            });

            it("also detects root files of collections outside of the project directory", () => {
                const outsideRequestFile = `/other/${requestFile}`;
                const files = { [outsideRequestFile]: requestFileContent };
                const languageService = createLanguageServiceWithPlugin(files);

                expect(
                    getDiagnosticCodes(languageService, outsideRequestFile),
                ).toEqual(diagnosticCodesWithoutCollection);

                writeFile(
                    files,
                    `/other/${collectionRootFile}`,
                    collectionRootFileContent,
                );

                expect(
                    getDiagnosticCodes(languageService, outsideRequestFile),
                ).toEqual(diagnosticCodesWithinCollection);
            });

            it("provides the runtime types after a missed creation of the root file once the project files change", () => {
                const files: Record<string, string> = {
                    [absoluteRequestFile]: requestFileContent,
                };
                const languageService = createLanguageServiceWithPlugin(files);

                expect(
                    getDiagnosticCodes(languageService, absoluteRequestFile),
                ).toEqual(diagnosticCodesWithoutCollection);

                // The watchers are not notified about the new root file.
                files[absoluteRootFile] = collectionRootFileContent;
                files["/collection/lib/other.js"] = "";

                expect(
                    getDiagnosticCodes(languageService, absoluteRequestFile),
                ).toEqual(diagnosticCodesWithinCollection);
            });

            it("resolves modules from the collection root after a missed creation of the root file once the project files change", () => {
                const content = createRequestFileContent(
                    'require("./lib/helper").missing();',
                );
                const files: Record<string, string> = {
                    "/collection/lib/helper.js": helperModule,
                    [absoluteRequestFile]: content,
                };
                const languageService = createLanguageServiceWithPlugin(files);

                // Property 'missing' does not exist on the type of the module.
                expect(
                    getDiagnosticCodes(languageService, absoluteRequestFile),
                ).not.toContain(2_339);

                // The watchers are not notified about the new root file.
                files[absoluteRootFile] = collectionRootFileContent;
                files["/collection/lib/other.js"] = "";

                expect(
                    getDiagnosticCodes(languageService, absoluteRequestFile),
                ).toEqual([2_339]);
            });

            it("does not parse the files again when the project files change without changing a collection", () => {
                const files: Record<string, string> = {
                    [absoluteRootFile]: collectionRootFileContent,
                    [absoluteRequestFile]: requestFileContent,
                };
                const languageService = createLanguageServiceWithPlugin(files);
                const sourceFile = languageService
                    .getProgram()
                    ?.getSourceFile(absoluteRequestFile);

                files["/collection/lib/other.js"] = "";

                expect(
                    languageService
                        .getProgram()
                        ?.getSourceFile(absoluteRequestFile),
                ).toBe(sourceFile);
            });
        },
    );

    it("closes the watchers when the language service is disposed", () => {
        const requestFile = "/collection/users/get-user.bru";
        const languageService = createLanguageServiceWithPlugin({
            "/collection/bruno.json": '{ "type": "collection" }',
            [requestFile]: "script:pre-request {\n}\n",
        });
        // The collection is only determined when needed.
        languageService.getSemanticDiagnostics(requestFile);

        expect(directoryWatchers.length).toBeGreaterThan(0);
        expect(fileWatchers.length).toBeGreaterThan(0);

        languageService.dispose();

        expect(
            [...directoryWatchers, ...fileWatchers].every(
                ({ closed }) => closed,
            ),
        ).toBe(true);
    });

    it("reads each directory only once when determining the collections of files in sibling directories", () => {
        const languageService = createLanguageServiceWithPlugin({
            "/collection/bruno.json": '{ "type": "collection" }',
            "/collection/a/b/one.bru": "script:pre-request {\n}\n",
            "/collection/a/c/two.bru": "script:pre-request {\n}\n",
            "/collection/a/d/three.bru": "script:pre-request {\n}\n",
        });

        languageService.getSemanticDiagnostics("/collection/a/b/one.bru");
        languageService.getSemanticDiagnostics("/collection/a/c/two.bru");
        languageService.getSemanticDiagnostics("/collection/a/d/three.bru");

        expect(new Set(readDirectories).size).toBe(readDirectories.length);
    });
});
