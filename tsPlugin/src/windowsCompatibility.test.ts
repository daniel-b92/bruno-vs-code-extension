import { describe, it, expect } from "@jest/globals";
import {
    createLanguageServiceWithPlugin,
    createPlugin,
    getCompletionNames,
    getDiagnosticTexts,
    removeCursor,
} from "./_testingUtils";
import { PluginConfiguration } from "./pluginConfiguration";

describe("files with Windows line breaks", () => {
    const requestFile = "/collection/request.bru";
    const yamlRequestFile = "/collection/request.yml";

    describe.each([{ lineBreak: "\n" }, { lineBreak: "\r\n" }])(
        "with line break $lineBreak",
        ({ lineBreak }) => {
            it("reports bru diagnostics at the positions within the original file", () => {
                const content = toLineBreak(
                    `meta {
  name: request
}

script:pre-request {
  const a = 1;
  valeu;
  res.status;
}

script:post-response {
  req.getUrl();
  await bru.sleep(1);
  res.status;
}

tests {
  await bru.sleep(1);
  res.status;
}
`,
                    lineBreak,
                );

                expect(
                    getDiagnosticTexts(
                        createLanguageServiceWithPlugin(
                            withBruCollection(requestFile, content),
                        ),
                        requestFile,
                        content,
                    ),
                ).toEqual([
                    { code: 2_304, text: "valeu" },
                    { code: 18_048, text: "res" },
                ]);
            });

            it("wraps code blocks that have only little space in front of them", () => {
                const content = toLineBreak(
                    `script:pre-request {
  const a = 1;
}
tests {
  const status = await Promise.resolve(res.status);
  for await (const value of [status]) {
    status + value;
  }
}
`,
                    lineBreak,
                );

                expect(
                    getDiagnosticTexts(
                        createLanguageServiceWithPlugin(
                            withBruCollection(requestFile, content),
                        ),
                        requestFile,
                        content,
                    ),
                ).toEqual([]);
            });

            it("does not report syntax errors for the content outside of code blocks", () => {
                const content = toLineBreak(
                    `meta {
  name: request
}

docs {
  This is not code: {
}

tests {
  expect(1).to.equal(1);
}
`,
                    lineBreak,
                );
                const languageService = createLanguageServiceWithPlugin(
                    withBruCollection(requestFile, content),
                );

                expect(
                    languageService.getSyntacticDiagnostics(requestFile),
                ).toEqual([]);
                expect(
                    languageService.getSemanticDiagnostics(requestFile),
                ).toEqual([]);
            });

            it("provides completions within bru code blocks", () => {
                const { content, position } = removeCursor(
                    toLineBreak(
                        `meta {
  name: request
}

script:pre-request {
  bru.getEnv§
}
`,
                        lineBreak,
                    ),
                );

                expect(
                    getCompletionNames(
                        createLanguageServiceWithPlugin(
                            withBruCollection(requestFile, content),
                        ),
                        requestFile,
                        position,
                    ),
                ).toContain("getEnvName");
            });

            it("reports Yaml diagnostics at the positions within the original file", () => {
                const content = toLineBreak(
                    `info:
  name: request
runtime:
  scripts:
    - type: before-request
      code: |-
        valeu;
        res.status;
        await bru.sleep(1);
    - type: tests
      code: |-
        await bru.sleep(1);
        res.status;
`,
                    lineBreak,
                );

                expect(
                    getDiagnosticTexts(
                        createLanguageServiceWithPlugin({
                            "/collection/opencollection.yml":
                                "opencollection: 1.0.0\n",
                            [yamlRequestFile]: content,
                        }),
                        yamlRequestFile,
                        content,
                    ),
                ).toEqual([
                    { code: 2_304, text: "valeu" },
                    { code: 18_048, text: "res" },
                ]);
            });
        },
    );
});

describe("files on a Windows drive", () => {
    const requestFile = "c:/collection/request.bru";
    const brunoJson = "c:/collection/bruno.json";

    it("provides the runtime types and reports diagnostics for bru files", () => {
        const content = `script:pre-request {
  valeu;
  bru.missing();
  res.status;
}
`;

        expect(
            getDiagnosticTexts(
                createWindowsLanguageService({
                    [brunoJson]: '{ "type": "collection" }',
                    [requestFile]: content,
                }),
                requestFile,
                content,
            ),
        ).toEqual([
            { code: 2_304, text: "valeu" },
            { code: 2_339, text: "missing" },
            { code: 18_048, text: "res" },
        ]);
    });

    it("resolves imports relative to the root folder of the collection", () => {
        const content = `script:pre-request {
  const lib = require("./lib/helper");
  lib.missing();
}
`;

        expect(
            getDiagnosticTexts(
                createWindowsLanguageService({
                    [brunoJson]: '{ "type": "collection" }',
                    "c:/collection/lib/helper.js":
                        "module.exports = { helper: () => 1 };",
                    "c:/collection/requests/request.bru": content,
                }),
                "c:/collection/requests/request.bru",
                content,
            ),
        ).toEqual([{ code: 2_339, text: "missing" }]);
    });

    it("detects Yaml collections", () => {
        const content = `runtime:
  scripts:
    - type: tests
      code: |-
        valeu;
`;

        expect(
            getDiagnosticTexts(
                createWindowsLanguageService({
                    "c:/collection/opencollection.yml":
                        "opencollection: 1.0.0\n",
                    "c:/collection/request.yml": content,
                }),
                "c:/collection/request.yml",
                content,
            ),
        ).toEqual([{ code: 2_304, text: "valeu" }]);
    });

    describe("additional context roots", () => {
        // The roots are passed by the extension as file system paths, the Typescript server uses forward slashes.
        it.each([
            {
                description: "with backslashes",
                root: "C:\\Users\\me\\scripts",
                fileName: "C:/Users/me/scripts/helper.js",
            },
            {
                description: "with a trailing backslash",
                root: "C:\\Users\\me\\scripts\\",
                fileName: "C:/Users/me/scripts/nested/helper.js",
            },
        ])("are found $description", expectRootToBeFound);

        it.each([
            {
                description: "with a different case of the drive letter",
                root: "C:\\Users\\me\\scripts",
                fileName: "c:/Users/me/scripts/helper.js",
            },
            {
                description: "with a different case of folder names",
                root: "C:\\Users\\Me\\Scripts",
                fileName: "c:/users/me/scripts/helper.js",
            },
        ])("are found $description", expectRootToBeFound);

        it("are only found with the same case on case sensitive platforms", () => {
            const configuration = new PluginConfiguration();
            configuration.update({
                additionalContextRoots: ["/home/me/Scripts"],
            });

            expect(
                configuration.getAdditionalContextRootContaining(
                    "/home/me/scripts/helper.js",
                    true,
                ),
            ).toBeUndefined();
            expect(
                configuration.getAdditionalContextRootContaining(
                    "/home/me/Scripts/helper.js",
                    true,
                ),
            ).toBeDefined();
        });

        it("are not found for files in other folders", () => {
            const configuration = new PluginConfiguration();
            configuration.update({
                additionalContextRoots: ["C:\\Users\\me\\scripts"],
            });

            expect(
                configuration.getAdditionalContextRootContaining(
                    "C:/Users/me/scripts-other/helper.js",
                    false,
                ),
            ).toBeUndefined();
        });

        it("provide the runtime types for javascript files", () => {
            const fileName = "c:/Users/me/scripts/helper.js";
            const content = "// @ts-check\nbru.missing();\n";

            expect(
                getDiagnosticTexts(
                    createWindowsLanguageService(
                        { [fileName]: content },
                        { additionalContextRoots: ["c:\\Users\\me\\scripts"] },
                    ),
                    fileName,
                    content,
                ),
            ).toEqual([{ code: 2_339, text: "missing" }]);
        });
    });
});

function toLineBreak(content: string, lineBreak: string) {
    return content.replace(/\n/g, lineBreak);
}

function withBruCollection(requestFile: string, content: string) {
    return {
        "/collection/bruno.json": '{ "type": "collection" }',
        [requestFile]: content,
    };
}

function createWindowsLanguageService(
    files: Record<string, string>,
    config: Parameters<typeof createLanguageServiceWithPlugin>[2] = {},
) {
    return createLanguageServiceWithPlugin(files, createPlugin({}), config, {
        currentDirectory: "c:/collection",
        useCaseSensitiveFileNames: false,
    });
}

function expectRootToBeFound({
    root,
    fileName,
}: {
    root: string;
    fileName: string;
}) {
    const configuration = new PluginConfiguration();
    configuration.update({ additionalContextRoots: [root] });

    expect(
        configuration.getAdditionalContextRootContaining(fileName, false),
    ).toBeDefined();
}
