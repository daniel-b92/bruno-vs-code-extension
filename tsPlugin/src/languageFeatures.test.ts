import { describe, it, expect } from "@jest/globals";
import * as ts from "typescript/lib/tsserverlibrary";
import {
    createLanguageServiceWithPlugin,
    getCompletionNames,
    helperModule,
    removeCursor,
} from "./_testingUtils";

describe("language features", () => {
    describe.each([
        {
            format: "bru",
            collectionRootFile: {
                name: "bruno.json",
                content: '{ "type": "collection" }',
            },
            requestFile: "/collection/requests/request.bru",
            // The comment is not a part of the code. The marker for the cursor is removed before the file is added to the project.
            createRequestFileContent: (
                codeLines: string[],
                requestType = "http",
            ) =>
                `meta {\n  name: request\n  type: ${requestType}\n  seq: 1\n}\n\nget {\n  url: https://example.com/api/users/1\n  body: none\n  auth: none\n}\n\nheaders {\n  Content-Type: application/json\n}\n\nscript:pre-request {\n${codeLines.map((line) => `  ${line}\n`).join("")}}\n`,
            textOutsideOfCode: "Content-Type",
            codeBlockHeader: "script:pre-request {",
        },
        {
            format: "yaml",
            collectionRootFile: {
                name: "opencollection.yml",
                content: "opencollection: 1.0.0\n",
            },
            requestFile: "/collection/requests/request.yml",
            createRequestFileContent: (
                codeLines: string[],
                requestType = "http",
            ) =>
                `info:\n  name: request\n  type: ${requestType}\nruntime:\n  scripts:\n    - type: before-request\n      code: |-\n${codeLines.map((line) => `        ${line}\n`).join("")}`,
            textOutsideOfCode: "name: request",
            codeBlockHeader: "code: |-",
        },
    ])(
        "for $format files",
        ({
            collectionRootFile,
            requestFile,
            createRequestFileContent,
            textOutsideOfCode,
            codeBlockHeader,
        }) => {
            const createLanguageService = (
                codeLines: string[],
                requestType?: "http" | "grpc",
            ) => {
                const { content, position } = removeCursor(
                    createRequestFileContent(codeLines, requestType),
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

            it("allows renaming declarations within the code", () => {
                const { languageService, position, content } =
                    createLanguageService(["const val§ue = 1;", "value;"]);

                expect(
                    languageService.getRenameInfo(requestFile, position, {})
                        .canRename,
                ).toBe(true);
                expect(
                    getTexts(
                        content,
                        languageService.findRenameLocations(
                            requestFile,
                            position,
                            false,
                            false,
                            {},
                        ),
                    ),
                ).toEqual(["value", "value"]);
            });

            it.each([
                { codeLine: "§bru.getEnvName();", requestType: "http" },
                // Shadowed by a parameter of the wrapper of the code block, since it is not available in pre-request scripts.
                { codeLine: "§res.getStatus();", requestType: "http" },
                // Declared as a parameter of the wrapper of the code block.
                { codeLine: "§bru.getEnvName();", requestType: "grpc" },
            ] as const)(
                "does not allow renaming objects provided by Bruno at runtime ('$codeLine' in $requestType request)",
                ({ codeLine, requestType }) => {
                    const { languageService, position } = createLanguageService(
                        [codeLine],
                        requestType,
                    );

                    expect(
                        languageService.getRenameInfo(requestFile, position, {})
                            .canRename,
                    ).toBe(false);
                },
            );

            it.each([
                { codeLine: "§res.getStatus();", requestType: "http" },
                { codeLine: "§bru.getEnvName();", requestType: "grpc" },
            ] as const)(
                "does not return locations within the wrappers of code blocks ('$codeLine' in $requestType request)",
                ({ codeLine, requestType }) => {
                    const { languageService, position, content } =
                        createLanguageService(
                            [codeLine, codeLine.replace("§", "")],
                            requestType,
                        );
                    const name = codeLine.substring(1, 4);

                    expect(
                        getTexts(
                            content,
                            languageService.findRenameLocations(
                                requestFile,
                                position,
                                false,
                                false,
                                {},
                            ),
                        ),
                    ).toEqual([name, name]);
                    expect(
                        languageService.getDefinitionAtPosition(
                            requestFile,
                            position,
                        ),
                    ).toEqual([]);
                    expect(
                        languageService.findReferences(requestFile, position),
                    ).toEqual([]);
                    expect(
                        getTexts(
                            content,
                            languageService
                                .getDocumentHighlights(requestFile, position, [
                                    requestFile,
                                ])
                                ?.flatMap(
                                    ({ highlightSpans }) => highlightSpans,
                                ),
                        ),
                    ).toEqual([name, name]);
                },
            );
            describe("for the wrappers of code blocks", () => {
                const codeLines = [
                    "function add(a, b) {",
                    "  return a + b;",
                    "}",
                    "const val§ue = add(1, 2);",
                ];

                it("does not provide inlay hints for the wrappers", () => {
                    const { languageService, content } =
                        createLanguageService(codeLines);

                    expect(
                        languageService
                            .provideInlayHints(
                                requestFile,
                                { start: 0, length: content.length },
                                {
                                    includeInlayParameterNameHints: "all",
                                    includeInlayFunctionLikeReturnTypeHints: true,
                                    includeInlayVariableTypeHints: true,
                                    includeInlayFunctionParameterTypeHints: true,
                                },
                            )
                            .map(({ text }) => text),
                    ).toEqual([": any", ": any", ": any", ": any", "a:", "b:"]);
                });

                it("does not provide semantic classifications for the wrappers", () => {
                    const { languageService, content } =
                        createLanguageService(codeLines);

                    expect(
                        getClassifiedTexts(
                            content,
                            languageService.getEncodedSemanticClassifications(
                                requestFile,
                                { start: 0, length: content.length },
                                ts.SemanticClassificationFormat.TwentyTwenty,
                            ),
                        ),
                    ).toEqual(["add", "a", "b", "a", "b", "value", "add"]);
                });

                it("shows the declarations of the code without the wrappers in the outline", () => {
                    const { languageService } =
                        createLanguageService(codeLines);

                    expect(
                        languageService
                            .getNavigationTree(requestFile)
                            .childItems?.map(({ text }) => text),
                    ).toEqual(["add", "value"]);
                    expect(
                        languageService
                            .getNavigationBarItems(requestFile)
                            .map(({ text, childItems }) => ({
                                text,
                                childItems: childItems.map(
                                    ({ text: childText }) => childText,
                                ),
                            })),
                    ).toEqual([
                        { text: "<global>", childItems: ["add", "value"] },
                    ]);
                });

                it("does not provide outlining spans for the wrappers", () => {
                    const { languageService, content } =
                        createLanguageService(codeLines);

                    expect(
                        getTexts(
                            content,
                            languageService.getOutliningSpans(requestFile),
                        )?.map((text) => text.trim()),
                    ).toEqual([
                        expect.stringMatching(/^\{\s*return a \+ b;\s*\}$/),
                    ]);
                });

                it("does not extend the smart selection to the wrappers", () => {
                    const { languageService, content, position } =
                        createLanguageService(codeLines);
                    const ranges: ts.TextSpan[] = [];

                    for (
                        let range: ts.SelectionRange | undefined =
                            languageService.getSmartSelectionRange(
                                requestFile,
                                position,
                            );
                        range != undefined;
                        range = range.parent
                    ) {
                        ranges.push(range.textSpan);
                    }

                    expect(
                        ranges
                            .slice(0, 2)
                            .map(({ start, length }) =>
                                content.substring(start, start + length),
                            ),
                    ).toEqual(["value", "const value = add(1, 2);"]);
                    expect(
                        Math.min(...ranges.map(({ start }) => start)),
                    ).toBeGreaterThanOrEqual(
                        content.indexOf(codeBlockHeader) +
                            codeBlockHeader.length,
                    );
                });
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

        it("suggests parameters that are declared within the code, even if they are named like the objects that are not available", () => {
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
            expect(namesInPostResponseScript).toContain("req");
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

        it("does not suggest `req` and `res` in a code block of a gRPC request", () => {
            const { content, position } = removeCursor(
                `meta {
  name: request
  type: grpc
}

script:grpc:before-call-start {
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

            expect(names.includes("bru")).toBe(true);
            expect(names.includes("req")).toBe(false);
            expect(names.includes("res")).toBe(false);
        });
    });
});

function getTexts(
    fileContent: string,
    locations: readonly { textSpan: ts.TextSpan }[] | undefined,
) {
    return locations?.map(({ textSpan: { start, length } }) =>
        fileContent.substring(start, start + length),
    );
}

function getClassifiedTexts(
    fileContent: string,
    { spans }: ts.Classifications,
) {
    const texts: string[] = [];

    // The spans are encoded as triples of start, length and classification.
    for (let i = 0; i < spans.length; i += 3) {
        texts.push(fileContent.substring(spans[i], spans[i] + spans[i + 1]));
    }

    return texts;
}
