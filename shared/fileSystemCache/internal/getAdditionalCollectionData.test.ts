import { describe, it, expect, jest } from "@jest/globals";
import { join } from "path";
import {
    AdditionalCollectionComplexDataProvider,
    AdditionalCollectionDataProviderType,
    AdditionalCollectionSimpleDataProvider,
    BrunoFileType,
    CollectionDirectory,
    CollectionFormat,
    NonBrunoSpecificItemType,
    ParsedFileDataForComplexProvider,
    VariableScopeSectionKind,
} from "../..";
import { useTemporaryDirectories } from "../../_testingUtils";
import { getAdditionalCollectionData } from "./getAdditionalCollectionData";

describe("getAdditionalCollectionData", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    describe("for the Yaml format", () => {
        const settingsFileContent = `request:
  headers:
    - name: a
      value: "{{fromSettings}}"
`;

        it.each([
            { description: "folder", isCollectionRoot: false },
            { description: "collection root", isCollectionRoot: true },
        ])(
            "parses the settings file of a $description directory",
            async ({ isCollectionRoot }) => {
                const directory = await createTemporaryDirectory({
                    "folder.yml": settingsFileContent,
                });

                const result = await getAdditionalCollectionData(
                    new CollectionDirectory(directory),
                    createProvider(join(directory, "folder.yml")),
                    isCollectionRoot,
                    false,
                    CollectionFormat.Yaml,
                );

                expect(result).toEqual([
                    expect.objectContaining({
                        kind: VariableScopeSectionKind.Request,
                        variableReferences: [
                            expect.objectContaining({
                                variableName: "fromSettings",
                            }),
                        ],
                    }),
                ]);
            },
        );

        it("passes no sections to the callback, when the settings file does not exist", async () => {
            const directory = await createTemporaryDirectory();

            const result = await getAdditionalCollectionData(
                new CollectionDirectory(directory),
                createProvider(join(directory, "folder.yml")),
                false,
                false,
                CollectionFormat.Yaml,
            );

            expect(result).toBeUndefined();
        });
    });

    describe("for the Bru format", () => {
        it("parses the settings file of a directory", async () => {
            const directory = await createTemporaryDirectory({
                "folder.bru": `headers {\n  a: {{fromSettings}}\n}\n`,
            });

            const result = await getAdditionalCollectionData(
                new CollectionDirectory(directory),
                createProvider(join(directory, "folder.bru")),
                false,
                false,
                CollectionFormat.Bru,
            );

            expect(result).toEqual([
                expect.objectContaining({
                    kind: VariableScopeSectionKind.Request,
                    variableReferences: [
                        expect.objectContaining({
                            variableName: "fromSettings",
                        }),
                    ],
                }),
            ]);
        });
    });

    it("passes the root information to the callback of a simple provider", async () => {
        const item = new CollectionDirectory("/collection");
        const callback =
            jest.fn<
                AdditionalCollectionSimpleDataProvider<undefined>["callback"]
            >();

        await getAdditionalCollectionData(
            item,
            {
                paramType:
                    AdditionalCollectionDataProviderType.SimpleCollectionItem,
                callback,
                isAdditionalDataOutdated: () => false,
            },
            false,
            true,
            CollectionFormat.Bru,
        );

        expect(callback).toHaveBeenCalledWith(item, false, true);
    });
});

/** The provider just returns the parsed sections (or `undefined`, if no file could be parsed). */
function createProvider(
    filePathForParsing: string,
): AdditionalCollectionComplexDataProvider<
    ParsedFileDataForComplexProvider["sections"] | undefined
> {
    return {
        paramType:
            AdditionalCollectionDataProviderType.WithAdditionalFullParsing,
        itemTypesRequiringFullFileParsing: [
            NonBrunoSpecificItemType.Directory,
            BrunoFileType.RequestFile,
        ],
        callbacksForItemsRequiringFullParsing: {
            getFilePathForParsing: () => filePathForParsing,
            getData: (parsedFile) => parsedFile?.sections,
        },
        callbackForOtherItems: () => undefined,
        isAdditionalDataOutdated: () => true,
    };
}
