import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { window } from "vscode";
import { readFile } from "fs/promises";
import { join } from "path";
import { CollectionDirectory, CollectionFormat } from "@global_shared";
import {
    createCollectionWithItems,
    createItemProviderStub,
    folderSettingsContent,
    getFolderSequences,
    getModifiedFiles,
    markFilesAsUnmodified,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import {
    createExtensionContextStub,
    mockVsCodeSettings,
} from "../../../../_testingUtils";
import { initializeSequenceGapsHint } from "../sequenceUtils/sequenceGapsHint";
import { BrunoTreeItem, TypedCollectionItemProvider } from "@shared";
import { FolderDropInsertionOption } from "../folderDropInsertionOptionEnum";
import { updateSequencesAfterMovingFolder } from "./updateSequencesAfterMovingFolder";

describe("updateSequencesAfterMovingFolder", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("moving into a target folder", () => {
        it("appends the folder with the highest sequence plus one, without changing other folders", async () => {
            const directory = await createFoldersForMovingIntoTarget();
            const unmodifiedFolders = await markFilesAsUnmodified(directory, [
                "target/s1/folder.bru",
                "target/s2/folder.bru",
                "old/a/folder.bru",
                "old/b/folder.bru",
            ]);

            await moveIntoTarget(directory);

            expect(
                await getFolderSequences(directory, CollectionFormat.Bru),
            ).toEqual({
                "target/s1": 1,
                "target/s2": 5,
                // The sequence of the moved folder from its old parent must not be considered.
                "target/moved": 6,
                "old/a": 2,
                "old/b": 5,
            });
            expect(await getModifiedFiles(unmodifiedFolders)).toEqual([]);
        });

        it("appends the folder with the highest sequence plus the configured step", async () => {
            mockVsCodeSettings({ "bru-as-code.sequenceStep": 10 });
            const directory = await createFoldersForMovingIntoTarget();

            await moveIntoTarget(directory);

            expect(
                (await getFolderSequences(directory, CollectionFormat.Bru))[
                    "target/moved"
                ],
            ).toBe(15);
        });

        it("renumbers the target folder and the old parent with the configured step, if enabled", async () => {
            mockVsCodeSettings({
                "bru-as-code.renumberSequencesAutomatically": true,
                "bru-as-code.sequenceStep": 10,
            });
            const directory = await createFoldersForMovingIntoTarget();

            await moveIntoTarget(directory);

            expect(
                await getFolderSequences(directory, CollectionFormat.Bru),
            ).toEqual({
                "target/s1": 10,
                "target/s2": 20,
                "target/moved": 30,
                "old/a": 10,
                "old/b": 20,
            });
        });
    });

    describe("inserting before or after a target folder within the same parent", () => {
        it("only changes the sequence of the moved folder, if there is a gap", async () => {
            const directory = await createFoldersForReordering([10, 20, 30]);
            const unmodifiedFolders = await markFilesAsUnmodified(directory, [
                "f1/folder.bru",
                "f2/folder.bru",
            ]);

            await moveWithinParent(
                directory,
                "f3",
                { folder: "f2", sequence: 20 },
                FolderDropInsertionOption.InsertBeforeTarget,
            );

            expect(
                await getFolderSequences(directory, CollectionFormat.Bru),
            ).toEqual({
                f1: 10,
                f3: 15,
                f2: 20,
            });
            expect(await getModifiedFiles(unmodifiedFolders)).toEqual([]);
        });

        it("inserts after the target folder", async () => {
            const directory = await createFoldersForReordering([10, 20, 30]);

            await moveWithinParent(
                directory,
                "f3",
                { folder: "f1", sequence: 10 },
                FolderDropInsertionOption.InsertAfterTarget,
            );

            expect(
                await getFolderSequences(directory, CollectionFormat.Bru),
            ).toEqual({
                f1: 10,
                f3: 15,
                f2: 20,
            });
        });

        it("shifts only the consecutive following folders, if there is no gap", async () => {
            const directory = await createFoldersForReordering([1, 2, 3, 10]);

            await moveWithinParent(
                directory,
                "f4",
                { folder: "f1", sequence: 1 },
                FolderDropInsertionOption.InsertAfterTarget,
            );

            expect(
                await getFolderSequences(directory, CollectionFormat.Bru),
            ).toEqual({
                f1: 1,
                f4: 2,
                f2: 3,
                f3: 4,
            });
        });

        it("shows the hint about sequence gaps for three shifted folders", async () => {
            initializeSequenceGapsHint(createExtensionContextStub());
            const showInformationMessage = jest.spyOn(
                window,
                "showInformationMessage",
            );
            const directory = await createFoldersForReordering([1, 2, 3, 4, 5]);

            await moveWithinParent(
                directory,
                "f5",
                { folder: "f1", sequence: 1 },
                FolderDropInsertionOption.InsertAfterTarget,
            );

            expect(showInformationMessage).toHaveBeenCalledTimes(1);
            expect(showInformationMessage.mock.calls[0]?.[0]).toContain(
                "3 other items",
            );
        });

        it("uses the highest sequence plus the step when moving behind the last folder", async () => {
            mockVsCodeSettings({ "bru-as-code.sequenceStep": 10 });
            const directory = await createFoldersForReordering([10, 20, 30]);

            await moveWithinParent(
                directory,
                "f1",
                { folder: "f3", sequence: 30 },
                FolderDropInsertionOption.InsertAfterTarget,
            );

            expect(
                (await getFolderSequences(directory, CollectionFormat.Bru))[
                    "f1"
                ],
            ).toBe(40);
        });

        it("renumbers the parent folder with the configured step, if enabled", async () => {
            mockVsCodeSettings({
                "bru-as-code.renumberSequencesAutomatically": true,
                "bru-as-code.sequenceStep": 5,
            });
            const directory = await createFoldersForReordering([10, 20, 30]);

            await moveWithinParent(
                directory,
                "f3",
                { folder: "f1", sequence: 10 },
                FolderDropInsertionOption.InsertAfterTarget,
            );

            expect(
                await getFolderSequences(directory, CollectionFormat.Bru),
            ).toEqual({
                f1: 5,
                f3: 10,
                f2: 15,
            });
        });
    });

    describe("with a yaml collection", () => {
        const format = CollectionFormat.Yaml;

        it("only changes the sequence of the moved folder, if there is a gap", async () => {
            const directory = await createTemporaryDirectory({
                "f1/folder.yml": folderSettingsContent(format, "f1", 10),
                "f2/folder.yml": folderSettingsContent(format, "f2", 20),
                "f3/folder.yml": folderSettingsContent(format, "f3", 30),
            });
            const unmodifiedFolders = await markFilesAsUnmodified(directory, [
                "f1/folder.yml",
                "f2/folder.yml",
            ]);

            await moveWithinParent(
                directory,
                "f3",
                { folder: "f2", sequence: 20 },
                FolderDropInsertionOption.InsertBeforeTarget,
                format,
            );

            expect(await getFolderSequences(directory, format)).toEqual({
                f1: 10,
                f3: 15,
                f2: 20,
            });
            expect(await getModifiedFiles(unmodifiedFolders)).toEqual([]);
        });

        it("only shifts the directly consecutive following folders, if there is no gap", async () => {
            const directory = await createTemporaryDirectory({
                "f1/folder.yml": folderSettingsContent(format, "f1", 1),
                "f2/folder.yml": folderSettingsContent(format, "f2", 2),
                "f3/folder.yml": folderSettingsContent(format, "f3", 3),
                "f4/folder.yml": folderSettingsContent(format, "f4", 10),
                "f5/folder.yml": folderSettingsContent(format, "f5", 11),
            });

            await moveWithinParent(
                directory,
                "f5",
                { folder: "f1", sequence: 1 },
                FolderDropInsertionOption.InsertAfterTarget,
                format,
            );

            expect(await getFolderSequences(directory, format)).toEqual({
                f1: 1,
                f5: 2,
                f2: 3,
                f3: 4,
                f4: 10,
            });
        });
    });

    describe("folder settings of the moved folder", () => {
        const otherSettings = "vars:pre-request {\n  keepMe: 1\n}\n";

        it("keeps all other settings when moving within the same parent", async () => {
            const directory = await createTemporaryDirectory({
                "a/folder.bru": `${folderSettingsContent(CollectionFormat.Bru, "a", 1)}\n${otherSettings}`,
                "b/folder.bru": folderSettingsContent(
                    CollectionFormat.Bru,
                    "b",
                    2,
                ),
            });

            await updateSequencesAfterMovingFolder(
                createItemProviderStub<TypedCollectionItemProvider>(
                    directory,
                    CollectionFormat.Bru,
                ),
                join(directory, "a"),
                treeItem(join(directory, "b"), 2),
                FolderDropInsertionOption.InsertAfterTarget,
            );

            expect(await readSettings(directory, "a")).toBe(
                `${folderSettingsContent(CollectionFormat.Bru, "a", 3)}\n${otherSettings}`,
            );
            expect(await readSettings(directory, "b")).toBe(
                folderSettingsContent(CollectionFormat.Bru, "b", 2),
            );
        });

        it("updates the settings at the new location and does not create anything at the old location, when moving to another parent", async () => {
            const directory = await createTemporaryDirectory({
                "new/b/folder.bru": folderSettingsContent(
                    CollectionFormat.Bru,
                    "b",
                    2,
                ),
                "new/moved/folder.bru": `${folderSettingsContent(CollectionFormat.Bru, "moved", 9)}\n${otherSettings}`,
            });

            // The new parent folder needs to be registered, so that the sequences of its subfolders are considered.
            const { itemProvider } =
                createCollectionWithItems<TypedCollectionItemProvider>(
                    [new CollectionDirectory(join(directory, "new"))],
                    CollectionFormat.Bru,
                    [],
                    directory,
                );

            await updateSequencesAfterMovingFolder(
                itemProvider,
                // The folder was already moved from its old location `old/moved`.
                join(directory, "old", "moved"),
                treeItem(join(directory, "new", "b"), 2),
                FolderDropInsertionOption.InsertAfterTarget,
            );

            expect(await readSettings(directory, "new/b")).toBe(
                folderSettingsContent(CollectionFormat.Bru, "b", 2),
            );
            expect(await readSettings(directory, "new/moved")).toBe(
                `${folderSettingsContent(CollectionFormat.Bru, "moved", 3)}\n${otherSettings}`,
            );
            expect(await readSettings(directory, "old/moved")).toBeUndefined();
        });
    });

    /** The moved folder (`target/moved`) already has its new path and the sequence from its old parent. */
    async function createFoldersForMovingIntoTarget() {
        return await createTemporaryDirectory({
            "target/s1/folder.bru": folderSettingsContent(
                CollectionFormat.Bru,
                "s1",
                1,
            ),
            "target/s2/folder.bru": folderSettingsContent(
                CollectionFormat.Bru,
                "s2",
                5,
            ),
            "target/moved/folder.bru": folderSettingsContent(
                CollectionFormat.Bru,
                "moved",
                9,
            ),
            "old/a/folder.bru": folderSettingsContent(
                CollectionFormat.Bru,
                "a",
                2,
            ),
            "old/b/folder.bru": folderSettingsContent(
                CollectionFormat.Bru,
                "b",
                5,
            ),
        });
    }

    async function moveIntoTarget(directory: string) {
        // The parent folders need to be registered in the collection, so that their subfolders are considered.
        const { itemProvider } =
            createCollectionWithItems<TypedCollectionItemProvider>(
                [
                    new CollectionDirectory(join(directory, "target")),
                    new CollectionDirectory(join(directory, "old")),
                ],
                CollectionFormat.Bru,
                [],
                directory,
            );

        await updateSequencesAfterMovingFolder(
            itemProvider,
            join(directory, "old", "moved"),
            treeItem(join(directory, "target")),
            FolderDropInsertionOption.MoveIntoTargetAsSubfolder,
        );
    }

    /** Creates the folders `f1`, `f2`, ... with the given sequences. */
    async function createFoldersForReordering(sequences: number[]) {
        return await createTemporaryDirectory(
            Object.fromEntries(
                sequences.map((sequence, index) => [
                    `f${index + 1}/folder.bru`,
                    folderSettingsContent(
                        CollectionFormat.Bru,
                        `f${index + 1}`,
                        sequence,
                    ),
                ]),
            ),
        );
    }

    async function moveWithinParent(
        directory: string,
        movedFolder: string,
        target: { folder: string; sequence: number },
        insertionOption: FolderDropInsertionOption,
        format = CollectionFormat.Bru,
    ) {
        await updateSequencesAfterMovingFolder(
            createItemProviderStub<TypedCollectionItemProvider>(
                directory,
                format,
            ),
            join(directory, movedFolder),
            treeItem(join(directory, target.folder), target.sequence),
            insertionOption,
        );
    }
});

function treeItem(path: string, sequence?: number) {
    return {
        getPath: () => path,
        getSequence: () => sequence,
    } as unknown as BrunoTreeItem;
}

async function readSettings(directory: string, folder: string) {
    return await readFile(join(directory, folder, "folder.bru"), "utf-8").catch(
        () => undefined,
    );
}
