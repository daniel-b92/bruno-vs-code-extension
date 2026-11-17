import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { readFile, stat, utimes } from "fs/promises";
import { join } from "path";
import { workspace } from "vscode";
import { CollectionDirectory, CollectionFormat } from "@global_shared";
import {
    createCollectionWithItems,
    createItemProviderStub,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { BrunoTreeItem, TypedCollectionItemProvider } from "@shared";
import { FolderDropInsertionOption } from "../folderDropInsertionOptionEnum";
import { updateSequencesAfterMovingFolder } from "./updateSequencesAfterMovingFolder";

describe("updateSequencesAfterMovingFolder", () => {
    const createTemporaryDirectory = useTemporaryDirectories();
    const unmodifiedTime = new Date("2000-01-01T00:00:00Z");

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("moving into a target folder", () => {
        it("appends the folder with the highest sequence plus one, without changing other folders", async () => {
            const directory = await createFoldersForMovingIntoTarget();
            const unmodifiedFolders = await markAsUnmodified(directory, [
                "target/s1",
                "target/s2",
                "old/a",
                "old/b",
            ]);

            await moveIntoTarget(directory);

            expect(await getSequences(directory)).toEqual({
                "target/s1": 1,
                "target/s2": 5,
                // The sequence of the moved folder from its old parent must not be considered.
                "target/moved": 6,
                "old/a": 2,
                "old/b": 5,
            });
            expect(
                await getModifiedFolders(directory, unmodifiedFolders),
            ).toEqual([]);
        });

        it("appends the folder with the highest sequence plus the configured step", async () => {
            mockSettings({ "bru-as-code.sequenceStep": 10 });
            const directory = await createFoldersForMovingIntoTarget();

            await moveIntoTarget(directory);

            expect((await getSequences(directory))["target/moved"]).toBe(15);
        });

        it("renumbers the target folder and the old parent with the configured step, if enabled", async () => {
            mockSettings({
                "bru-as-code.renumberSequencesAutomatically": true,
                "bru-as-code.sequenceStep": 10,
            });
            const directory = await createFoldersForMovingIntoTarget();

            await moveIntoTarget(directory);

            expect(await getSequences(directory)).toEqual({
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
            const unmodifiedFolders = await markAsUnmodified(directory, [
                "f1",
                "f2",
            ]);

            await moveWithinParent(
                directory,
                "f3",
                { folder: "f2", sequence: 20 },
                FolderDropInsertionOption.InsertBeforeTarget,
            );

            expect(await getSequences(directory)).toEqual({
                f1: 10,
                f3: 15,
                f2: 20,
            });
            expect(
                await getModifiedFolders(directory, unmodifiedFolders),
            ).toEqual([]);
        });

        it("inserts after the target folder", async () => {
            const directory = await createFoldersForReordering([10, 20, 30]);

            await moveWithinParent(
                directory,
                "f3",
                { folder: "f1", sequence: 10 },
                FolderDropInsertionOption.InsertAfterTarget,
            );

            expect(await getSequences(directory)).toEqual({
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

            expect(await getSequences(directory)).toEqual({
                f1: 1,
                f4: 2,
                f2: 3,
                f3: 4,
            });
        });

        it("uses the highest sequence plus the step when moving behind the last folder", async () => {
            mockSettings({ "bru-as-code.sequenceStep": 10 });
            const directory = await createFoldersForReordering([10, 20, 30]);

            await moveWithinParent(
                directory,
                "f1",
                { folder: "f3", sequence: 30 },
                FolderDropInsertionOption.InsertAfterTarget,
            );

            expect((await getSequences(directory))["f1"]).toBe(40);
        });

        it("renumbers the parent folder with the configured step, if enabled", async () => {
            mockSettings({
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

            expect(await getSequences(directory)).toEqual({
                f1: 5,
                f3: 10,
                f2: 15,
            });
        });
    });

    /** The moved folder (`target/moved`) already has its new path and the sequence from its old parent. */
    async function createFoldersForMovingIntoTarget() {
        return await createTemporaryDirectory({
            "target/s1/folder.bru": folderSettingsFile("s1", 1),
            "target/s2/folder.bru": folderSettingsFile("s2", 5),
            "target/moved/folder.bru": folderSettingsFile("moved", 9),
            "old/a/folder.bru": folderSettingsFile("a", 2),
            "old/b/folder.bru": folderSettingsFile("b", 5),
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
                    folderSettingsFile(`f${index + 1}`, sequence),
                ]),
            ),
        );
    }

    async function moveWithinParent(
        directory: string,
        movedFolder: string,
        target: { folder: string; sequence: number },
        insertionOption: FolderDropInsertionOption,
    ) {
        await updateSequencesAfterMovingFolder(
            createItemProviderStub<TypedCollectionItemProvider>(
                directory,
                CollectionFormat.Bru,
            ),
            join(directory, movedFolder),
            treeItem(join(directory, target.folder), target.sequence),
            insertionOption,
        );
    }

    /** Sets the modification time of the folder settings files to a fixed time in the past, so that it can be detected afterwards whether they were written. */
    async function markAsUnmodified(directory: string, folders: string[]) {
        for (const folder of folders) {
            await utimes(
                join(directory, folder, "folder.bru"),
                unmodifiedTime,
                unmodifiedTime,
            );
        }

        return folders;
    }

    async function getModifiedFolders(directory: string, folders: string[]) {
        const modified: string[] = [];

        for (const folder of folders) {
            if (
                (
                    await stat(join(directory, folder, "folder.bru"))
                ).mtime.getTime() != unmodifiedTime.getTime()
            ) {
                modified.push(folder);
            }
        }

        return modified;
    }
});

function folderSettingsFile(name: string, sequence: number) {
    return `meta {\n  name: ${name}\n  seq: ${sequence}\n}\n`;
}

function treeItem(path: string, sequence?: number) {
    return {
        getPath: () => path,
        getSequence: () => sequence,
    } as unknown as BrunoTreeItem;
}

function mockSettings(settings: Record<string, unknown>) {
    jest.spyOn(workspace, "getConfiguration").mockReturnValue({
        get: (key: string) => settings[key],
    } as never);
}

/** Returns the sequences of the given folders (keys are relative folder paths), by default of all folders that contain a `folder.bru` file. */
async function getSequences(directory: string) {
    const folders = [
        ...["f1", "f2", "f3", "f4"],
        ...["target/s1", "target/s2", "target/moved", "old/a", "old/b"],
    ];
    const sequences: Record<string, number> = {};

    for (const folder of folders) {
        const content = await readFile(
            join(directory, folder, "folder.bru"),
            "utf-8",
        ).catch(() => undefined);

        if (content !== undefined) {
            sequences[folder] = Number(/seq: (-?\d+)/.exec(content)?.[1]);
        }
    }

    return sequences;
}
