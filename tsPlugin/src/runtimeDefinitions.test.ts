import { describe, it, expect } from "@jest/globals";
import {
    createLanguageServiceWithPlugin,
    getSemanticDiagnosticCodes,
    helperModule,
} from "./_testingUtils";

describe("handling of code blocks like Javascript", () => {
    describe.each([
        {
            format: "bru",
            collectionRootFile: {
                name: "bruno.json",
                content: '{ "type": "collection" }',
            },
            requestFile: "/collection/requests/request.bru",
            createRequestFileContent: (codeLines: string[]) =>
                `meta {\n  name: request\n}\n\nscript:pre-request {\n${codeLines.map((line) => `  ${line}\n`).join("")}}\n`,
        },
        {
            format: "yaml",
            collectionRootFile: {
                name: "opencollection.yml",
                content: "opencollection: 1.0.0\n",
            },
            requestFile: "/collection/requests/request.yml",
            createRequestFileContent: (codeLines: string[]) =>
                `info:\n  name: request\nruntime:\n  scripts:\n    - type: before-request\n      code: |-\n${codeLines.map((line) => `        ${line}\n`).join("")}`,
        },
    ])(
        "for $format files",
        ({ collectionRootFile, requestFile, createRequestFileContent }) => {
            const getSemanticDiagnosticCodes = (codeLines: string[]) =>
                createLanguageServiceWithPlugin({
                    [`/collection/${collectionRootFile.name}`]:
                        collectionRootFile.content,
                    "/collection/lib/helper.js": helperModule,
                    [requestFile]: createRequestFileContent(codeLines),
                })
                    .getSemanticDiagnostics(requestFile)
                    .map(({ code }) => code);

            it("respects JSDoc types", () => {
                expect(
                    getSemanticDiagnosticCodes([
                        "/** @type {number} */",
                        'const text = "text";',
                    ]),
                ).toEqual([2_322]); // Type 'string' is not assignable to type 'number'.
            });

            it("resolves modules relative to the collection root folder", () => {
                // The request file is not located in the collection root folder.
                expect(
                    getSemanticDiagnosticCodes([
                        'const lib = require("./lib/helper");',
                        "lib.helper();",
                        "lib.missing();",
                    ]),
                ).toEqual([2_339]); // Property 'missing' does not exist on type '{ helper: () => number; }'.
            });
        },
    );
});

describe("inbuilt runtime definitions", () => {
    describe.each([
        {
            format: "bru",
            collectionRootFile: {
                name: "bruno.json",
                content: '{ "type": "collection" }',
            },
            requestFile: "/collection/requests/request.bru",
            createRequestFileContent: (codeLines: string[]) =>
                `meta {\n  name: request\n}\n\nscript:pre-request {\n${codeLines.map((line) => `  ${line}\n`).join("")}}\n`,
        },
        {
            format: "yaml",
            collectionRootFile: {
                name: "opencollection.yml",
                content: "opencollection: 1.0.0\n",
            },
            requestFile: "/collection/requests/request.yml",
            createRequestFileContent: (codeLines: string[]) =>
                `info:\n  name: request\nruntime:\n  scripts:\n    - type: before-request\n      code: |-\n${codeLines.map((line) => `        ${line}\n`).join("")}`,
        },
    ])(
        "for $format files",
        ({ collectionRootFile, requestFile, createRequestFileContent }) => {
            it("provides the types of the objects that are available at runtime", () => {
                const fileContent = createRequestFileContent([
                    "/** @type {number} */",
                    'const value = bru.getEnvVar("a");',
                    "const name = bru.getEnvName();",
                    "const url = req.getUrl();",
                    "const method = req.getMethod();",
                    "bru.missing();",
                ]);

                const diagnostics = createLanguageServiceWithPlugin({
                    [`/collection/${collectionRootFile.name}`]:
                        collectionRootFile.content,
                    [requestFile]: fileContent,
                }).getSemanticDiagnostics(requestFile);

                // `bru.getEnvVar` returns `any`.
                expect(
                    diagnostics.map(({ code, start, length }) => ({
                        code,
                        text: fileContent.substring(start!, start! + length!),
                    })),
                ).toEqual([
                    // Property 'missing' does not exist on the type of 'bru'.
                    { code: 2_339, text: "missing" },
                ]);
            });
        },
    );

    it("provides the types of the objects that are available at runtime for Javascript files within a collection", () => {
        const scriptFile = "/collection/scripts/script.js";

        expect(
            getSemanticDiagnosticCodes(
                {
                    "/collection/bruno.json": '{ "type": "collection" }',
                    [scriptFile]: "// @ts-check\nbru.getEnvVar(1);\n",
                },
                scriptFile,
            ),
        ).toEqual([2_345]); // Argument of type 'number' is not assignable to parameter of type 'string'.
    });

    it("resolves `chai` and `mocha` from the `node_modules` of the collection", () => {
        const scriptFile = "/collection/scripts/script.js";

        expect(
            getSemanticDiagnosticCodes(
                {
                    "/collection/bruno.json": '{ "type": "collection" }',
                    "/collection/node_modules/@types/chai/index.d.ts":
                        "export function expect(value: unknown): { isChai: true };",
                    "/collection/node_modules/@types/mocha/index.d.ts":
                        "export function test(name: string): void;",
                    [scriptFile]:
                        "// @ts-check\n/** @type {number} */\nconst a = expect(1);\ntest(1);\n",
                },
                scriptFile,
            ),
        ).toEqual([2_322, 2_345]);
    });

    it("supports multiple collections in the same project", () => {
        const files = {
            "/collection1/bruno.json": '{ "type": "collection" }',
            "/collection1/request.bru":
                "script:pre-request {\n  bru.getEnvVar(1);\n}\n",
            "/collection2/bruno.json": '{ "type": "collection" }',
            "/collection2/request.bru":
                "script:pre-request {\n  bru.getEnvVar(2);\n}\n",
        };

        expect(
            getSemanticDiagnosticCodes(files, "/collection1/request.bru"),
        ).toEqual([2_345]);
        expect(
            getSemanticDiagnosticCodes(files, "/collection2/request.bru"),
        ).toEqual([2_345]);
    });

    it("ignores temporary files from older versions of the extension", () => {
        const scriptFile = "/collection/scripts/script.js";
        const files = {
            "/collection/bruno.json": '{ "type": "collection" }',
            // Same structure as the files that were created by older versions (the objects are assigned to the global object).
            "/collection/__temp_bru_reference.js":
                "const bru = { getEnvVar: (/** @type {number} */ name) => name };\nglobalThis.bru = bru;\n",
            [scriptFile]: '// @ts-check\nbru.getEnvVar("a");\n',
        };

        expect(getSemanticDiagnosticCodes(files, scriptFile)).toEqual([]);
    });

    it("does not provide the types of the objects that are available at runtime for files outside of collections", () => {
        const scriptFile = "/other/script.js";
        const languageService = createLanguageServiceWithPlugin({
            "/collection/bruno.json": '{ "type": "collection" }',
            [scriptFile]: "// @ts-check\nbru.getEnvVar(1);\n",
        });

        expect(
            languageService
                .getSemanticDiagnostics(scriptFile)
                .map(({ code }) => code),
        ).toEqual([2_304]); // Cannot find name 'bru'.
    });

    it("does not include the virtual file with the definitions in the results for navigation", () => {
        const requestFile = "/collection/request.bru";
        const content = "script:pre-request {\n  bru.getEnvVar('a');\n}\n";
        const languageService = createLanguageServiceWithPlugin({
            "/collection/bruno.json": '{ "type": "collection" }',
            [requestFile]: content,
        });

        expect(
            languageService.getDefinitionAtPosition(
                requestFile,
                content.indexOf("getEnvVar"),
            ),
        ).toEqual([]);
    });
});
