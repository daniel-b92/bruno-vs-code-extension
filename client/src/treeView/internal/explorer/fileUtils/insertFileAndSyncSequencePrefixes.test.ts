import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { readdir } from "fs/promises";
import { join } from "path";
import { window, workspace } from "vscode";
import {
    BrunoFolderSettingsFile,
    CollectionDirectory,
    CollectionFormat,
    getFolderSettingsFileName,
} from "@global_shared";
import {
    createCollectionWithItems,
    folderSettingsContent,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "@shared";
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

        async function insertSettingsFile(targetFolder: string) {
            mockVsCodeSettings({
                "bru-as-code.prefixNamesWithSequence": true,
                "bru-as-code.sequenceStep": 10,
            });
            jest.spyOn(workspace, "applyEdit").mockImplementation(
                applyWorkspaceEdit,
            );
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
    },
);
