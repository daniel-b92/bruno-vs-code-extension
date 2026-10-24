import { describe, it, expect } from "@jest/globals";
import { dirname } from "path";
import * as ts from "typescript/lib/tsserverlibrary";
import init = require("./index");
import { PluginConfig } from "./pluginConfiguration";

const helperModule = `function helper() {
    return 1;
}

module.exports = { helper };
`;

describe("code fixes and refactorings", () => {
    describe.each([
        {
            format: "bru",
            collectionRootFile: {
                name: "bruno.json",
                content: '{ "type": "collection" }',
            },
            requestFileName: "request.bru",
            indentationForExtractedConstant: { spaces: "    ", tabs: "\t" },
            requestFileContent: `meta {
  name: request
}

script:pre-request {
  const value = 1;
  const text = "a" + value;
  valeu;
  helper();
}
`,
        },
        {
            format: "yaml",
            collectionRootFile: {
                name: "opencollection.yml",
                content: "opencollection: 1.0.0\n",
            },
            requestFileName: "request.yml",
            // A line with less indentation than the script would end the Yaml block scalar. Tabs are not allowed for indenting Yaml content.
            indentationForExtractedConstant: {
                spaces: "        ",
                tabs: "        ",
            },
            requestFileContent: `info:
  name: request
runtime:
  scripts:
    - type: before-request
      code: |-
        const value = 1;
        const text = "a" + value;
        valeu;
        helper();
    - type: tests
      code: |-
        test("x", () => {});
`,
        },
    ])(
        "for $format files",
        ({
            collectionRootFile,
            requestFileName,
            indentationForExtractedConstant,
            requestFileContent,
        }) => {
            const collectionFiles = {
                [`/collection/${collectionRootFile.name}`]:
                    collectionRootFile.content,
                "/collection/lib/helper.js": helperModule,
                [`/collection/${requestFileName}`]: requestFileContent,
            };
            const requestFile = `/collection/${requestFileName}`;

            it("provides code fixes that only change code within code blocks", () => {
                const languageService =
                    createLanguageServiceWithPlugin(collectionFiles);

                expect(
                    getCodeFixNames(
                        languageService,
                        requestFile,
                        requestFileContent,
                        "valeu",
                    ),
                ).toEqual(["spelling"]);
            });

            it("does not provide code fixes that insert code outside of code blocks", () => {
                const languageService =
                    createLanguageServiceWithPlugin(collectionFiles);

                // Without filtering, an import would be added at the top of the file and a function declaration at the end of the file.
                expect(
                    getCodeFixNames(
                        languageService,
                        requestFile,
                        requestFileContent,
                        "helper",
                    ),
                ).toEqual([]);
            });

            it("provides edits for refactorings that only change code within code blocks", () => {
                const languageService =
                    createLanguageServiceWithPlugin(collectionFiles);

                expect(
                    getEditsForRefactor(
                        languageService,
                        requestFile,
                        getSelection(requestFileContent, '"a" + value'),
                        "Convert to template string",
                    ),
                ).toBeDefined();
            });

            it("does not provide edits for refactorings that insert code outside of code blocks", () => {
                const languageService =
                    createLanguageServiceWithPlugin(collectionFiles);

                // Without filtering, the function would be added at the end of the file.
                expect(
                    getEditsForRefactor(
                        languageService,
                        requestFile,
                        getSelection(requestFileContent, '"a" + value'),
                        "Extract to function in global scope",
                    ),
                ).toBeUndefined();
            });

            it.each([
                { indentationStyle: "spaces", convertTabsToSpaces: true },
                { indentationStyle: "tabs", convertTabsToSpaces: false },
            ] as const)(
                "provides edits for extracting constants that keep the indentation of the code block when indenting with $indentationStyle",
                ({ indentationStyle, convertTabsToSpaces }) => {
                    const languageService =
                        createLanguageServiceWithPlugin(collectionFiles);

                    const edits = getEditsForRefactor(
                        languageService,
                        requestFile,
                        getSelection(requestFileContent, '"a" + value'),
                        "Extract to constant in enclosing scope",
                        { convertTabsToSpaces },
                    );

                    expect(
                        edits?.edits.flatMap(({ textChanges }) =>
                            textChanges.map(({ newText }) => newText),
                        ),
                    ).toContain(
                        `${indentationForExtractedConstant[indentationStyle]}const newLocal = "a" + value;\n`,
                    );
                },
            );
        },
    );
});

describe("Yaml collection support", () => {
    const requestFile = "/collection/request.yml";
    const collectionFiles = {
        "/collection/opencollection.yml": "opencollection: 1.0.0\n",
        [requestFile]: `runtime:
  scripts:
    - type: tests
      code: |-
        valeu;
`,
    };

    it("only provides diagnostics for scripts in Yaml files once Yaml collections are supported", () => {
        const plugin = createPlugin({ yamlCollectionSupport: false });
        const languageService = createLanguageServiceWithPlugin(
            collectionFiles,
            plugin,
        );

        expect(languageService.getSemanticDiagnostics(requestFile)).toEqual([]);

        plugin.onConfigurationChanged({ yamlCollectionSupport: true });

        expect(
            languageService
                .getSemanticDiagnostics(requestFile)
                .map(({ code }) => code),
        ).toEqual([2_304]); // Cannot find name 'valeu'.
    });

    it("does not provide formatting edits for Yaml files", () => {
        const languageService =
            createLanguageServiceWithPlugin(collectionFiles);

        expect(
            languageService.getFormattingEditsForDocument(
                requestFile,
                ts.getDefaultFormatCodeSettings(),
            ),
        ).toEqual([]);
    });
});

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

function createLanguageServiceWithPlugin(
    files: Record<string, string>,
    plugin = createPlugin({ yamlCollectionSupport: true }),
) {
    const languageServiceHost: ts.LanguageServiceHost = {
        getScriptFileNames: () =>
            Object.keys(files).filter(
                (fileName) => !fileName.endsWith(".json"),
            ),
        getScriptVersion: () => "1",
        getScriptSnapshot: (fileName) => {
            const content = files[fileName] ?? ts.sys.readFile(fileName);

            return content != undefined
                ? ts.ScriptSnapshot.fromString(content)
                : undefined;
        },
        getCurrentDirectory: () => "/collection",
        // Like for inferred projects of the Typescript server, files with any extension are handled.
        getCompilationSettings: () => ({
            allowJs: true,
            allowNonTsExtensions: true,
            target: ts.ScriptTarget.ES2020,
        }),
        getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
        fileExists: (fileName) =>
            fileName in files || ts.sys.fileExists(fileName),
        readFile: (fileName) => files[fileName] ?? ts.sys.readFile(fileName),
    };
    const serverHost = {
        directoryExists: (directory: string) =>
            Object.keys(files).some((fileName) =>
                fileName.startsWith(`${directory}/`),
            ),
        readDirectory: (directory: string) =>
            Object.keys(files).filter(
                (fileName) => dirname(fileName) == directory,
            ),
    } as unknown as ts.server.ServerHost;

    return plugin.create({
        languageService: ts.createLanguageService(languageServiceHost),
        languageServiceHost,
        serverHost,
    } as ts.server.PluginCreateInfo);
}

function createPlugin(config: PluginConfig) {
    const plugin = init({ typescript: ts });
    plugin.onConfigurationChanged(config);

    return plugin;
}

function getCodeFixNames(
    languageService: ts.LanguageService,
    fileName: string,
    fileContent: string,
    diagnosticText: string,
) {
    const diagnostic = languageService
        .getSemanticDiagnostics(fileName)
        .find(
            ({ start, length }) =>
                start != undefined &&
                length != undefined &&
                fileContent.substring(start, start + length) == diagnosticText,
        );

    if (!diagnostic || diagnostic.start == undefined) {
        throw new Error(`No diagnostic found for '${diagnosticText}'.`);
    }

    return languageService
        .getCodeFixesAtPosition(
            fileName,
            diagnostic.start,
            diagnostic.start + (diagnostic.length ?? 0),
            [diagnostic.code],
            ts.getDefaultFormatCodeSettings(),
            {},
        )
        .map(({ fixName }) => fixName);
}

function getSelection(fileContent: string, selectedText: string) {
    const start = fileContent.indexOf(selectedText);

    return { pos: start, end: start + selectedText.length };
}

function getEditsForRefactor(
    languageService: ts.LanguageService,
    fileName: string,
    selection: ts.TextRange,
    actionDescription: string,
    formatOptions?: ts.FormatCodeSettings,
) {
    const applicableRefactor = languageService
        .getApplicableRefactors(fileName, selection, {})
        .flatMap(({ name, actions }) =>
            actions.map((action) => ({ refactorName: name, action })),
        )
        .find(({ action }) => action.description == actionDescription);

    if (!applicableRefactor) {
        throw new Error(
            `Refactoring '${actionDescription}' is not applicable.`,
        );
    }

    return languageService.getEditsForRefactor(
        fileName,
        { ...ts.getDefaultFormatCodeSettings(), ...formatOptions },
        selection,
        applicableRefactor.refactorName,
        applicableRefactor.action.name,
        {},
    );
}
