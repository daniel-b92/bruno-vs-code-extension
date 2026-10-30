import { describe, it, expect } from "@jest/globals";
import * as ts from "typescript/lib/tsserverlibrary";
import { createLanguageServiceWithPlugin, helperModule } from "./_testingUtils";

describe("file renames and pasting", () => {
    describe.each([
        {
            format: "bru",
            collectionRootFile: {
                name: "bruno.json",
                content: '{ "type": "collection" }',
            },
            requestFileName: "request.bru",
            requestFileContent: `meta {
  name: request
}

script:pre-request {
  const { helper } = require("./lib/helper");
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
            requestFileContent: `info:
  name: request
runtime:
  scripts:
    - type: before-request
      code: |-
        const { helper } = require("./lib/helper");
        helper();
`,
        },
    ])(
        "for $format files",
        ({ collectionRootFile, requestFileName, requestFileContent }) => {
            // Bruno resolves modules relative to the collection root, so the request file is placed in a subfolder.
            const requestFile = `/collection/requests/${requestFileName}`;
            const collectionFiles = {
                [`/collection/${collectionRootFile.name}`]:
                    collectionRootFile.content,
                "/collection/lib/helper.js": helperModule,
                [requestFile]: requestFileContent,
            };

            it("updates module paths relative to the collection root when an imported file is renamed", () => {
                const languageService =
                    createLanguageServiceWithPlugin(collectionFiles);

                const edits = getEditsForFileRename(
                    languageService,
                    "/collection/lib/helper.js",
                    "/collection/lib/helper2.js",
                );

                expect(edits).toEqual([
                    { fileName: requestFile, newTexts: ["./lib/helper2"] },
                ]);
            });

            it("updates module paths relative to the collection root when the folder of an imported file is renamed", () => {
                const languageService =
                    createLanguageServiceWithPlugin(collectionFiles);

                const edits = getEditsForFileRename(
                    languageService,
                    "/collection/lib",
                    "/collection/utils",
                );

                expect(edits).toEqual([
                    { fileName: requestFile, newTexts: ["./utils/helper"] },
                ]);
            });

            it.each([
                {
                    renamedPath: requestFile,
                    newPath: `/collection/other/${requestFileName}`,
                },
                {
                    renamedPath: "/collection/requests",
                    newPath: "/collection/other",
                },
            ])(
                "does not change module paths when $renamedPath is moved",
                ({ renamedPath, newPath }) => {
                    const languageService =
                        createLanguageServiceWithPlugin(collectionFiles);

                    expect(
                        getEditsForFileRename(
                            languageService,
                            renamedPath,
                            newPath,
                        ),
                    ).toEqual([]);
                },
            );

            // The Typescript server would compute the edits for the masked content and keep the masked content as the content of the file afterwards.
            it("does not provide edits for pasting into code blocks", () => {
                const languageService =
                    createLanguageServiceWithPlugin(collectionFiles);
                const position = requestFileContent.indexOf("helper();");

                expect(
                    languageService.getPasteEdits(
                        {
                            targetFile: requestFile,
                            pastedText: ["helper();"],
                            pasteLocations: [{ pos: position, end: position }],
                            copiedFrom: undefined,
                            preferences: {},
                        },
                        ts.getDefaultFormatCodeSettings(),
                    ).edits,
                ).toEqual([]);
            });

            it("does not prepare edits for pasting code copied from code blocks", () => {
                const languageService =
                    createLanguageServiceWithPlugin(collectionFiles);
                const position = requestFileContent.indexOf("helper();");

                expect(
                    languageService.preparePasteEditsForFile(requestFile, [
                        { pos: position, end: position + "helper();".length },
                    ]),
                ).toBe(false);
            });
        },
    );
});

function getEditsForFileRename(
    languageService: ts.LanguageService,
    oldFilePath: string,
    newFilePath: string,
) {
    return languageService
        .getEditsForFileRename(
            oldFilePath,
            newFilePath,
            ts.getDefaultFormatCodeSettings(),
            {},
        )
        .map(({ fileName, textChanges }) => ({
            fileName,
            newTexts: textChanges.map(({ newText }) => newText),
        }));
}
