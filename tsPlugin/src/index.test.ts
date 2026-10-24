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

    it("uses the configuration that the Typescript server passes on creation of the plugin", () => {
        const languageService = createLanguageServiceWithPlugin(
            collectionFiles,
            createPlugin({}),
            { yamlCollectionSupport: true },
        );

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
                    "const status = res.status;",
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

describe("handling of code blocks in bru files", () => {
    const collectionFiles = {
        "/collection/bruno.json": '{ "type": "collection" }',
    };
    const requestFile = "/collection/request.bru";
    // Provides enough space in front of the code blocks for the wrappers with typed parameters.
    const requestBlocks = `meta {
  name: request
  type: http
  seq: 1
}

get {
  url: https://example.com/api/users/1
  body: none
  auth: none
}

headers {
  Content-Type: application/json
}
`;

    it("does not report syntax errors for the content outside of code blocks", () => {
        const languageService = createLanguageServiceWithPlugin({
            ...collectionFiles,
            [requestFile]: `${requestBlocks}
docs {
  This is not code: {
}
`,
        });

        expect(languageService.getSyntacticDiagnostics(requestFile)).toEqual(
            [],
        );
        expect(languageService.getSemanticDiagnostics(requestFile)).toEqual([]);
    });

    it("reports diagnostics at the positions within the original file", () => {
        const content = `${requestBlocks}
script:pre-request {
  const a = 1;
  valeu;
}
`;

        expect(
            getDiagnosticTexts(
                createLanguageServiceWithPlugin({
                    ...collectionFiles,
                    [requestFile]: content,
                }),
                requestFile,
                content,
            ),
        ).toEqual([{ code: 2_304, text: "valeu" }]);
    });

    it("allows top-level `await` and `return` in code blocks", () => {
        const content = `${requestBlocks}
script:pre-request {
  await bru.sleep(1);
  return;
}

tests {
  await bru.sleep(1);
  return;
}
`;

        expect(
            getDiagnosticTexts(
                createLanguageServiceWithPlugin({
                    ...collectionFiles,
                    [requestFile]: content,
                }),
                requestFile,
                content,
            ),
        ).toEqual([]);
    });

    it("still reports `await` within non-async functions", () => {
        const content = `${requestBlocks}
script:pre-request {
  function sleep() {
    await bru.sleep(1);
  }
}
`;

        expect(
            getDiagnosticTexts(
                createLanguageServiceWithPlugin({
                    ...collectionFiles,
                    [requestFile]: content,
                }),
                requestFile,
                content,
            ),
        ).toEqual([{ code: 1_308, text: "await" }]);
    });

    it("scopes the declarations of each code block separately", () => {
        const content = `${requestBlocks}
script:pre-request {
  const a = 1;
  var b = 1;
}

script:post-response {
  const a = 2;
  var b = 2;
}

tests {
  const a = 3;
  var b = 3;
}
`;

        expect(
            getDiagnosticTexts(
                createLanguageServiceWithPlugin({
                    ...collectionFiles,
                    [requestFile]: content,
                }),
                requestFile,
                content,
            ),
        ).toEqual([]);
    });

    it("reports the usage of objects that are not available in a code block", () => {
        const content = `${requestBlocks}
script:pre-request {
  res.status;
  req.getUrl();
}

assert {
  res.status: eq 200
  res.body.message: isString
}

script:post-response {
  req.getUrl();
  res.status;
}
`;

        expect(
            getDiagnosticTexts(
                createLanguageServiceWithPlugin({
                    ...collectionFiles,
                    [requestFile]: content,
                }),
                requestFile,
                content,
            ),
        ).toEqual([
            // 'res' is possibly 'undefined'.
            { code: 18_048, text: "res" },
            // 'req' is possibly 'undefined'.
            { code: 18_048, text: "req" },
        ]);
    });

    it("only provides the parts of `bru.grpc` that are available in a code block of a gRPC request", () => {
        const content = `meta {
  name: request
  type: grpc
  seq: 1
}

grpc {
  url: localhost:50051
  method: /example.Greeter/SayHello
  methodType: unary
}

script:grpc:before-call-start {
  bru.grpc.request.url;
  bru.grpc.response.statusCode;
}

docs {
  Documentation that provides space for the wrapper of the next code block
}

script:grpc:after-call-end {
  bru.grpc.response.statusCode;
  bru.grpc.request.url;
}
`;

        expect(
            getDiagnosticTexts(
                createLanguageServiceWithPlugin({
                    ...collectionFiles,
                    [requestFile]: content,
                }),
                requestFile,
                content,
            ),
        ).toEqual([
            // Property 'response' does not exist on type '{ request: ... }'.
            { code: 2_339, text: "response" },
            { code: 2_339, text: "request" },
        ]);
    });

    it("does not shadow the unavailable objects if there is not enough space in front of the code block", () => {
        const content = `get {
  url: https://example.com
}
script:pre-request {
  res.status;
}
`;

        expect(
            getDiagnosticTexts(
                createLanguageServiceWithPlugin({
                    ...collectionFiles,
                    [requestFile]: content,
                }),
                requestFile,
                content,
            ),
        ).toEqual([]);
    });

    it("does not provide formatting edits", () => {
        const requestFileContent = `${requestBlocks}
script:pre-request {
const a   = 1;
}
`;
        const languageService = createLanguageServiceWithPlugin({
            ...collectionFiles,
            [requestFile]: requestFileContent,
        });

        expect(
            languageService.getFormattingEditsForDocument(
                requestFile,
                ts.getDefaultFormatCodeSettings(),
            ),
        ).toEqual([]);
    });
});

describe("hovers, completions and signature help", () => {
    describe.each([
        {
            format: "bru",
            collectionRootFile: {
                name: "bruno.json",
                content: '{ "type": "collection" }',
            },
            requestFile: "/collection/requests/request.bru",
            // The comment is not a part of the code. The marker for the cursor is removed before the file is added to the project.
            createRequestFileContent: (codeLines: string[]) =>
                `meta {\n  name: request\n  type: http\n  seq: 1\n}\n\nget {\n  url: https://example.com/api/users/1\n  body: none\n  auth: none\n}\n\nheaders {\n  Content-Type: application/json\n}\n\nscript:pre-request {\n${codeLines.map((line) => `  ${line}\n`).join("")}}\n`,
            textOutsideOfCode: "Content-Type",
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
            textOutsideOfCode: "name: request",
        },
    ])(
        "for $format files",
        ({
            collectionRootFile,
            requestFile,
            createRequestFileContent,
            textOutsideOfCode,
        }) => {
            const createLanguageService = (codeLines: string[]) => {
                const { content, position } = removeCursor(
                    createRequestFileContent(codeLines),
                );

                return {
                    position,
                    content,
                    languageService: createLanguageServiceWithPlugin({
                        [`/collection/${collectionRootFile.name}`]:
                            collectionRootFile.content,
                        "/collection/lib/helper.js": helperModule,
                        "/collection/requests/local.js": helperModule,
                        [requestFile]: content,
                    }),
                };
            };

            it("provides hovers for the code", () => {
                const { languageService, position } = createLanguageService([
                    "bru.getEnv§Name();",
                ]);

                expect(
                    languageService
                        .getQuickInfoAtPosition(requestFile, position)
                        ?.displayParts?.map(({ text }) => text)
                        .join(""),
                ).toContain("getEnvName: () => string");
            });

            it("provides completions for the code", () => {
                const { languageService, position } = createLanguageService([
                    "bru.getEnv§",
                ]);

                expect(
                    getCompletionNames(languageService, requestFile, position),
                ).toEqual(expect.arrayContaining(["getEnvName", "getEnvVar"]));
            });

            it("provides completions for relative module paths based on the collection root folder", () => {
                // The request file is not located in the collection root folder.
                const { languageService, position } = createLanguageService([
                    'const lib = require("./§");',
                ]);

                const names = getCompletionNames(
                    languageService,
                    requestFile,
                    position,
                );

                expect(names).toEqual(
                    expect.arrayContaining(["lib", "requests"]),
                );
                expect(names).not.toContain("local");
            });

            it("provides completions for the files within a folder for relative module paths", () => {
                const { languageService, position } = createLanguageService([
                    'const lib = require("./lib/§");',
                ]);

                expect(
                    getCompletionNames(languageService, requestFile, position),
                ).toEqual(["helper"]);
            });

            it("only replaces the part of a relative module path behind the last slash", () => {
                const { languageService, position } = createLanguageService([
                    'const lib = require("./lib/he§");',
                ]);

                expect(
                    languageService
                        .getCompletionsAtPosition(requestFile, position, {})
                        ?.entries.map(({ replacementSpan }) => replacementSpan),
                ).toEqual([{ start: position - 2, length: 2 }]);
            });

            it("does not provide completions for relative module paths outside of calls to `require`", () => {
                const { languageService, position } = createLanguageService([
                    'const path = "./lib/§";',
                ]);

                expect(
                    getCompletionNames(languageService, requestFile, position),
                ).not.toContain("helper");
            });

            it("provides signature help for the code", () => {
                const { languageService, position } = createLanguageService([
                    "bru.getEnvVar(§",
                ]);

                expect(
                    languageService
                        .getSignatureHelpItems(requestFile, position, {})
                        ?.items.map(({ parameters }) => parameters.length),
                ).toEqual([1]);
            });

            it("provides nothing outside of the code", () => {
                const { languageService, content } = createLanguageService([
                    "bru.getEnvName();",
                ]);
                const position = content.indexOf(textOutsideOfCode) + 2;

                expect(
                    languageService.getQuickInfoAtPosition(
                        requestFile,
                        position,
                    ),
                ).toBeUndefined();
                expect(
                    languageService.getCompletionsAtPosition(
                        requestFile,
                        position,
                        {},
                    ),
                ).toBeUndefined();
                expect(
                    languageService.getSignatureHelpItems(
                        requestFile,
                        position,
                        {},
                    ),
                ).toBeUndefined();
            });

            it("provides no hovers and completions for the names of variables, since the extension provides them", () => {
                const { languageService, position } = createLanguageService([
                    'bru.getEnvVar("na§me");',
                ]);

                expect(
                    languageService.getQuickInfoAtPosition(
                        requestFile,
                        position,
                    ),
                ).toBeUndefined();
                expect(
                    languageService.getCompletionsAtPosition(
                        requestFile,
                        position,
                        {},
                    ),
                ).toBeUndefined();
            });

            it("provides no completions for the names of variables when the string is not closed yet", () => {
                const { languageService, position } = createLanguageService([
                    'bru.getVar("na§',
                ]);

                expect(
                    languageService.getCompletionsAtPosition(
                        requestFile,
                        position,
                        {},
                    ),
                ).toBeUndefined();
            });

            it("provides hovers for strings that are not names of variables", () => {
                const { languageService, position } = createLanguageService([
                    'const te§xt = "text";',
                ]);

                expect(
                    languageService.getQuickInfoAtPosition(
                        requestFile,
                        position,
                    ),
                ).toBeDefined();
            });

            it("does not suggest auto imports, since they would be inserted outside of the code", () => {
                const { languageService, position } = createLanguageService([
                    "hel§",
                ]);
                const completions = languageService.getCompletionsAtPosition(
                    requestFile,
                    position,
                    {
                        includeCompletionsForModuleExports: true,
                        includeCompletionsWithInsertText: true,
                    },
                );

                expect(
                    completions?.entries.filter(
                        ({ hasAction, source }) => hasAction || source,
                    ),
                ).toEqual([]);
            });

            it("does not suggest the types for the gRPC scripts", () => {
                const { languageService, position } = createLanguageService([
                    "/** @type {§} */",
                    "const value = 1;",
                ]);
                const names = getCompletionNames(
                    languageService,
                    requestFile,
                    position,
                );

                expect(names).toContain("PropertyList");
                expect(names.includes("BruForPreRequestGrpc")).toBe(false);
                expect(names.includes("BruForPostResponseGrpc")).toBe(false);
            });
        },
    );

    describe("for bru files", () => {
        const requestFile = "/collection/request.bru";
        // Provides enough space in front of the code blocks for the wrappers with typed parameters.
        const requestBlocks = `meta {
  name: request
  type: http
  seq: 1
}

get {
  url: https://example.com/api/users/1
  body: none
  auth: none
}

headers {
  Content-Type: application/json
}
`;

        it("only suggests the objects that are available in a code block", () => {
            const { content, position } = removeCursor(
                `${requestBlocks}
script:pre-request {
  const fn = (res) => {
    §
  };
}

headers {
  Content-Type: application/json
}

script:post-response {
  
}
`,
            );
            const languageService = createLanguageServiceWithPlugin({
                "/collection/bruno.json": '{ "type": "collection" }',
                [requestFile]: content,
            });

            const namesInPreRequestScript = getCompletionNames(
                languageService,
                requestFile,
                position,
            );
            const namesInPostResponseScript = getCompletionNames(
                languageService,
                requestFile,
                content.lastIndexOf("  \n}") + 2,
            );

            // The parameter of the function in the script is declared within the code.
            expect(namesInPreRequestScript).toContain("res");
            expect(namesInPreRequestScript).toContain("req");
            expect(namesInPostResponseScript).toContain("res");
            expect(namesInPostResponseScript.includes("req")).toBe(false);
        });

        it("does not suggest the objects that are not available in a code block", () => {
            const { content, position } = removeCursor(
                `${requestBlocks}
script:pre-request {
  §
}
`,
            );
            const names = getCompletionNames(
                createLanguageServiceWithPlugin({
                    "/collection/bruno.json": '{ "type": "collection" }',
                    [requestFile]: content,
                }),
                requestFile,
                position,
            );

            expect(names.includes("req")).toBe(true);
            expect(names.includes("res")).toBe(false);
        });
    });

    describe("for Javascript files within additional context roots", () => {
        const scriptFile = "/shared/scripts/script.js";
        const files = {
            "/collection/bruno.json": '{ "type": "collection" }',
            [scriptFile]: "// @ts-check\nbru.getEnvVar(1);\n",
        };

        it("provides the types of the objects that are available at runtime", () => {
            const plugin = createPlugin({
                additionalContextRoots: ["/shared"],
            });

            expect(
                createLanguageServiceWithPlugin(files, plugin)
                    .getSemanticDiagnostics(scriptFile)
                    .map(({ code }) => code),
            ).toEqual([2_345]); // Argument of type 'number' is not assignable to parameter of type 'string'.
        });

        it("does not provide the types for other folders", () => {
            const plugin = createPlugin({
                additionalContextRoots: ["/other"],
            });

            expect(
                createLanguageServiceWithPlugin(files, plugin)
                    .getSemanticDiagnostics(scriptFile)
                    .map(({ code }) => code),
            ).toEqual([2_304]); // Cannot find name 'bru'.
        });

        it("handles changes of the additional context roots", () => {
            const plugin = createPlugin({});
            const languageService = createLanguageServiceWithPlugin(
                files,
                plugin,
            );

            expect(
                languageService
                    .getSemanticDiagnostics(scriptFile)
                    .map(({ code }) => code),
            ).toEqual([2_304]);

            plugin.onConfigurationChanged({
                additionalContextRoots: ["\\shared\\", "/other"],
            });

            expect(
                languageService
                    .getSemanticDiagnostics(scriptFile)
                    .map(({ code }) => code),
            ).toEqual([2_345]);
        });

        it("does not include the virtual file with the definitions in the results for navigation", () => {
            const plugin = createPlugin({
                additionalContextRoots: ["/shared"],
            });
            const languageService = createLanguageServiceWithPlugin(
                {
                    ...files,
                    [scriptFile]: "bru.getEnvVar('a');\n",
                },
                plugin,
            );

            expect(
                languageService.getDefinitionAtPosition(
                    scriptFile,
                    "bru.".length,
                ),
            ).toEqual([]);
        });
    });
});

function getDiagnosticTexts(
    languageService: ts.LanguageService,
    fileName: string,
    fileContent: string,
) {
    return [
        ...languageService.getSyntacticDiagnostics(fileName),
        ...languageService.getSemanticDiagnostics(fileName),
    ].map(({ code, start, length }) => ({
        code,
        text: fileContent.substring(start!, start! + length!),
    }));
}

function getSemanticDiagnosticCodes(
    files: Record<string, string>,
    fileName: string,
) {
    return createLanguageServiceWithPlugin(files)
        .getSemanticDiagnostics(fileName)
        .map(({ code }) => code);
}

function createLanguageServiceWithPlugin(
    files: Record<string, string>,
    plugin = createPlugin({ yamlCollectionSupport: true }),
    pluginConfigFromServer?: Partial<PluginConfig>,
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
        getDirectories: (directory: string) => [
            ...new Set(
                Object.keys(files)
                    .filter((fileName) => fileName.startsWith(`${directory}/`))
                    .map((fileName) => fileName.slice(directory.length + 1))
                    .filter((path) => path.includes("/"))
                    .map((path) => path.split("/")[0]),
            ),
        ],
        readDirectory: (directory: string) =>
            Object.keys(files).filter(
                (fileName) => dirname(fileName) == directory,
            ),
    } as unknown as ts.server.ServerHost;

    return plugin.create({
        languageService: ts.createLanguageService(languageServiceHost),
        languageServiceHost,
        serverHost,
        config: pluginConfigFromServer,
    } as ts.server.PluginCreateInfo);
}

function createPlugin(config: Partial<PluginConfig>) {
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

/**
 * The cursor is marked with `§`.
 */
function removeCursor(contentWithCursor: string) {
    return {
        content: contentWithCursor.replace("§", ""),
        position: contentWithCursor.indexOf("§"),
    };
}

function getCompletionNames(
    languageService: ts.LanguageService,
    fileName: string,
    position: number,
) {
    return (
        languageService
            .getCompletionsAtPosition(fileName, position, {})
            ?.entries.map(({ name }) => name) ?? []
    );
}
