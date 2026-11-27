import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { readdir } from "fs/promises";
import { join } from "path";
import { window, workspace } from "vscode";
import {
    BrunoFolderSettingsFile,
    BrunoRequestFile,
    CollectionDirectory,
    CollectionFormat,
    getFileExtensionForFormat,
    getFolderSettingsFileName,
} from "@global_shared";
import {
    createCollectionWithItems,
    folderSettingsContent,
    getRequestSequences,
    requestContent,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { BrunoTreeItem, TypedCollectionItemProvider } from "@shared";
import {
    applyWorkspaceEdit,
    mockVsCodeSettings,
} from "../../../../_testingUtils";
import { insertFileAndSyncSequencePrefixes } from "./insertFileAndSyncSequencePrefixes";
import { RequestFileInsertionPositionType } from "./interfaces";

describe.each([CollectionFormat.Bru, CollectionFormat.Yaml])(
    "insertFileAndSyncSequencePrefixes (%s)",
    (format) => {
        const createTemporaryDirectory = useTemporaryDirectories();
        const settingsFile = getFolderSettingsFileName(format);

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it("renames the target folder of a folder settings file and returns the path in the renamed folder", async () => {
            const { directory, finalPath } = await insertSettingsFile("b");

            expect(finalPath).toBe(join(directory, "00010_b", settingsFile));
            expect((await readdir(directory)).sort()).toEqual([
                "00010_a",
                "00010_b",
            ]);
        });

        it("does not rename folders if a folder settings file is inserted into the collection root", async () => {
            const { directory, finalPath } = await insertSettingsFile("");

            expect(finalPath).toBe(join(directory, settingsFile));
            expect((await readdir(directory)).sort()).toEqual(
                ["00010_a", "b", settingsFile].sort(),
            );
        });

        it("does not rename folders if inserting the file failed", async () => {
            jest.spyOn(window, "showErrorMessage").mockResolvedValue(undefined);

            const { directory, finalPath } =
                await insertSettingsFile("missing");

            expect(finalPath).toBeUndefined();
            expect((await readdir(directory)).sort()).toEqual(["00010_a", "b"]);
        });

        it("does not rename items in the source folder when copying a request", async () => {
            mockPrefixSettings();
            const extension = getFileExtensionForFormat(format);
            const directory = await createTemporaryDirectory({
                [`a/00010_x${extension}`]: requestContent(format, "x", 10),
                // Does not match its sequence, but is not affected by copying the other request.
                [`a/00030_y${extension}`]: requestContent(format, "y", 20),
                "b/script.js": "",
            });
            const sourcePath = join(directory, "a", `00010_x${extension}`);
            const { itemProvider } =
                createCollectionWithItems<TypedCollectionItemProvider>(
                    [
                        new CollectionDirectory(join(directory, "a")),
                        new CollectionDirectory(join(directory, "b")),
                        new BrunoRequestFile(sourcePath, 10),
                        new BrunoRequestFile(
                            join(directory, "a", `00030_y${extension}`),
                            20,
                        ),
                    ],
                    format,
                    [],
                    directory,
                );

            expect(
                await insertFileAndSyncSequencePrefixes(
                    itemProvider,
                    new BrunoRequestFile(sourcePath, 10),
                    {
                        newPath: join(directory, "b", `00010_x${extension}`),
                        insertionPosition:
                            RequestFileInsertionPositionType.Folder,
                    },
                ),
            ).toBeDefined();
            expect((await readdir(join(directory, "a"))).sort()).toEqual([
                `00010_x${extension}`,
                `00030_y${extension}`,
            ]);
        });

        it.each(
            [10, undefined].flatMap((copiedSequence) =>
                [false, true].flatMap((renumber) =>
                    [false, true].map((isPastedOnFile) => ({
                        copiedSequence,
                        renumber,
                        isPastedOnFile,
                    })),
                ),
            ),
        )(
            "takes over the sequence of an overwritten request (copied sequence: $copiedSequence, renumbering: $renumber, pasted on file: $isPastedOnFile)",
            async ({ copiedSequence, renumber, isPastedOnFile }) => {
                mockVsCodeSettings({
                    "bru-as-code.renumberSequencesAutomatically": renumber,
                    "bru-as-code.sequenceStep": 10,
                });
                const extension = getFileExtensionForFormat(format);
                const files = [
                    { path: join("a", `x${extension}`), name: "x" },
                    { path: join("b", `x${extension}`), name: "x" },
                    { path: join("b", `first${extension}`), name: "first" },
                    { path: join("b", `last${extension}`), name: "last" },
                ];
                const sequences = [copiedSequence, 20, 10, 30];
                const directory = await createTemporaryDirectory(
                    Object.fromEntries(
                        files.map(({ path, name }, index) => [
                            path,
                            requestContent(format, name, sequences[index]),
                        ]),
                    ),
                );
                const items = files.map(
                    ({ path }, index) =>
                        new BrunoRequestFile(
                            join(directory, path),
                            sequences[index],
                        ),
                );
                const { itemProvider } =
                    createCollectionWithItems<TypedCollectionItemProvider>(
                        [
                            new CollectionDirectory(join(directory, "a")),
                            new CollectionDirectory(join(directory, "b")),
                            ...items,
                        ],
                        format,
                        [],
                        directory,
                    );
                const newPath = join(directory, "b", `x${extension}`);

                await insertFileAndSyncSequencePrefixes(
                    itemProvider,
                    items[0],
                    {
                        newPath,
                        insertionPosition: isPastedOnFile
                            ? {
                                  type: RequestFileInsertionPositionType.AfterFile,
                                  item: new BrunoTreeItem(
                                      newPath,
                                      true,
                                      false,
                                      20,
                                  ),
                              }
                            : RequestFileInsertionPositionType.Folder,
                    },
                );

                expect(await getRequestSequences(join(directory, "b"))).toEqual(
                    {
                        [`first${extension}`]: 10,
                        [`x${extension}`]: 20,
                        [`last${extension}`]: 30,
                    },
                );
            },
        );

        async function insertSettingsFile(targetFolder: string) {
            mockPrefixSettings();
            const directory = await createTemporaryDirectory({
                [`00010_a/${settingsFile}`]: folderSettingsContent(
                    format,
                    "a",
                    10,
                ),
                "b/script.js": "",
            });
            const sourcePath = join(directory, "00010_a", settingsFile);
            const { itemProvider } =
                createCollectionWithItems<TypedCollectionItemProvider>(
                    [
                        new CollectionDirectory(join(directory, "00010_a")),
                        new CollectionDirectory(join(directory, "b")),
                        new BrunoFolderSettingsFile(sourcePath),
                    ],
                    format,
                    [],
                    directory,
                );

            return {
                directory,
                finalPath: await insertFileAndSyncSequencePrefixes(
                    itemProvider,
                    new BrunoFolderSettingsFile(sourcePath),
                    {
                        newPath: join(directory, targetFolder, settingsFile),
                        insertionPosition:
                            RequestFileInsertionPositionType.Folder,
                    },
                ),
            };
        }

        function mockPrefixSettings() {
            mockVsCodeSettings({
                "bru-as-code.prefixNamesWithSequence": true,
                "bru-as-code.sequenceStep": 10,
            });
            jest.spyOn(workspace, "applyEdit").mockImplementation(
                applyWorkspaceEdit,
            );
        }
    },
);
