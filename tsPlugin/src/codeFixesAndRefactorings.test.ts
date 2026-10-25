import { describe, it, expect } from "@jest/globals";
import {
    createLanguageServiceWithPlugin,
    getCodeFixNames,
    getEditsForRefactor,
    getSelection,
    helperModule,
} from "./_testingUtils";

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
