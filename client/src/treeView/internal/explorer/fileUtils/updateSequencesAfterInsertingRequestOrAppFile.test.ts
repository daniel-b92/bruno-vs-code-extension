import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { readdir, readFile, stat, utimes } from "fs/promises";
import { join } from "path";
import { workspace } from "vscode";
import { CollectionDirectory, CollectionFormat } from "@global_shared";
import {
    createCollectionWithItems,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { BrunoTreeItem, TypedCollectionItemProvider } from "@shared";
import { updateSequencesAfterInsertingRequestOrAppFile } from "./updateSequencesAfterInsertingRequestOrAppFile";
import {
    FileInsertionPosition,
    RequestFileInsertionPositionType,
} from "./interfaces";

describe("updateSequencesAfterInsertingRequestOrAppFile", () => {
    const createTemporaryDirectory = useTemporaryDirectories();
    const unmodifiedTime = new Date("2000-01-01T00:00:00Z");

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("with the default settings", () => {
        it("only changes the sequence of the inserted file, if there is a gap after the target", async () => {
            const directory = await createTemporaryDirectory({
                "get-user.bru": requestFile("get-user", 10),
                "create-user.bru": requestFile("create-user", 20),
                "delete-user.bru": requestFile("delete-user", 30),
                "new.bru": requestFile("new", 10),
            });
            const unmodifiedFiles = await markAsUnmodified(directory, [
                "get-user.bru",
                "create-user.bru",
                "delete-user.bru",
            ]);

            await runUpdate(directory, afterFile(10), "new.bru");

            expect(await getSequences(directory)).toEqual({
                "get-user.bru": 10,
                "new.bru": 15,
                "create-user.bru": 20,
                "delete-user.bru": 30,
            });
            expect(await getModifiedFiles(directory, unmodifiedFiles)).toEqual(
                [],
            );
        });

        it("only shifts the directly consecutive following files, if there is no gap after the target", async () => {
            const directory = await createTemporaryDirectory({
                "a.bru": requestFile("a", 1),
                "b.bru": requestFile("b", 2),
                "c.bru": requestFile("c", 3),
                "d.bru": requestFile("d", 10),
                "new.bru": requestFile("new", 1),
            });
            const unmodifiedFiles = await markAsUnmodified(directory, [
                "a.bru",
                "d.bru",
            ]);

            await runUpdate(directory, afterFile(1), "new.bru");

            expect(await getSequences(directory)).toEqual({
                "a.bru": 1,
                "new.bru": 2,
                "b.bru": 3,
                "c.bru": 4,
                "d.bru": 10,
            });
            expect(await getModifiedFiles(directory, unmodifiedFiles)).toEqual(
                [],
            );
        });

        it("considers app files like request files", async () => {
            const directory = await createTemporaryDirectory({
                "app.bru": "meta {\n  name: app\n  type: app\n  seq: 2\n}\n",
                "b.bru": requestFile("b", 3),
                "new.bru": requestFile("new", 1),
            });

            await runUpdate(directory, afterFile(2), "new.bru");

            expect(await getSequences(directory)).toEqual({
                "app.bru": 2,
                "new.bru": 3,
                "b.bru": 4,
            });
        });

        it("appends the file with the highest sequence plus one, if the target is a folder", async () => {
            const directory = await createTemporaryDirectory({
                "a.bru": requestFile("a", 1),
                "b.bru": requestFile("b", 7),
                "new.bru": requestFile("new", 1),
            });
            const unmodifiedFiles = await markAsUnmodified(directory, [
                "a.bru",
                "b.bru",
            ]);

            await runUpdate(
                directory,
                RequestFileInsertionPositionType.Folder,
                "new.bru",
            );

            expect((await getSequences(directory))["new.bru"]).toBe(8);
            expect(await getModifiedFiles(directory, unmodifiedFiles)).toEqual(
                [],
            );
        });

        it("appends the file with the highest sequence plus the configured step", async () => {
            mockSettings({ "bru-as-code.sequenceStep": 10 });
            const directory = await createTemporaryDirectory({
                "a.bru": requestFile("a", 10),
                "b.bru": requestFile("b", 20),
                "new.bru": requestFile("new", 1),
            });

            await runUpdate(
                directory,
                RequestFileInsertionPositionType.Folder,
                "new.bru",
            );

            expect((await getSequences(directory))["new.bru"]).toBe(30);
        });

        it("uses the sequence of the target plus the step, if the target is the last file", async () => {
            mockSettings({ "bru-as-code.sequenceStep": 10 });
            const directory = await createTemporaryDirectory({
                "a.bru": requestFile("a", 10),
                "b.bru": requestFile("b", 20),
                "new.bru": requestFile("new", 1),
            });

            await runUpdate(directory, afterFile(20), "new.bru");

            expect((await getSequences(directory))["new.bru"]).toBe(30);
        });

        it("ignores the previous sequence of a file that is moved within its directory", async () => {
            const directory = await createTemporaryDirectory({
                "a.bru": requestFile("a", 1),
                "b.bru": requestFile("b", 2),
                "c.bru": requestFile("c", 3),
            });
            const unmodifiedFiles = await markAsUnmodified(directory, [
                "b.bru",
                "c.bru",
            ]);

            // Moves `a` behind `c`.
            await runUpdate(directory, afterFile(3), "a.bru");

            expect(await getSequences(directory)).toEqual({
                "b.bru": 2,
                "c.bru": 3,
                "a.bru": 4,
            });
            expect(await getModifiedFiles(directory, unmodifiedFiles)).toEqual(
                [],
            );
        });

        it("reorders files within a directory by only shifting the necessary files", async () => {
            const directory = await createTemporaryDirectory({
                "a.bru": requestFile("a", 1),
                "b.bru": requestFile("b", 2),
                "c.bru": requestFile("c", 3),
            });

            // Moves `c` behind `a`.
            await runUpdate(directory, afterFile(1), "c.bru");

            expect(await getSequences(directory)).toEqual({
                "a.bru": 1,
                "c.bru": 2,
                "b.bru": 3,
            });
        });

        it("does not modify the files of the directory that the file was moved away from", async () => {
            const { directory, otherDirectory, itemProvider } =
                await createDirectoriesForMovingFile();
            const unmodifiedFiles = await markAsUnmodified(otherDirectory, [
                "x.bru",
                "z.bru",
            ]);

            await updateSequencesAfterInsertingRequestOrAppFile(
                itemProvider,
                RequestFileInsertionPositionType.Folder,
                join(directory, "new.bru"),
                { targetDirectory: directory, otherDirectory },
            );

            expect(await getSequences(otherDirectory)).toEqual({
                "x.bru": 1,
                "z.bru": 3,
            });
            expect(
                await getModifiedFiles(otherDirectory, unmodifiedFiles),
            ).toEqual([]);
        });
    });

    describe("with automatic renumbering enabled", () => {
        it("renumbers the target directory with the configured step", async () => {
            mockSettings({
                "bru-as-code.renumberSequencesAutomatically": true,
                "bru-as-code.sequenceStep": 10,
            });
            const directory = await createTemporaryDirectory({
                "a.bru": requestFile("a", 3),
                "b.bru": requestFile("b", 40),
                "new.bru": requestFile("new", 1),
            });

            await runUpdate(directory, afterFile(3), "new.bru");

            expect(await getSequences(directory)).toEqual({
                "a.bru": 10,
                "new.bru": 20,
                "b.bru": 30,
            });
        });

        it("renumbers the directory that the file was moved away from", async () => {
            mockSettings({
                "bru-as-code.renumberSequencesAutomatically": true,
            });
            const { directory, otherDirectory, itemProvider } =
                await createDirectoriesForMovingFile();

            await updateSequencesAfterInsertingRequestOrAppFile(
                itemProvider,
                RequestFileInsertionPositionType.Folder,
                join(directory, "new.bru"),
                { targetDirectory: directory, otherDirectory },
            );

            expect(await getSequences(otherDirectory)).toEqual({
                "x.bru": 1,
                "z.bru": 2,
            });
        });
    });

    async function createDirectoriesForMovingFile() {
        const directory = await createTemporaryDirectory({
            "a.bru": requestFile("a", 1),
            "new.bru": requestFile("new", 2),
            // The file with the sequence 2 has already been moved away.
            "other/x.bru": requestFile("x", 1),
            "other/z.bru": requestFile("z", 3),
        });
        const otherDirectory = join(directory, "other");
        const { itemProvider } =
            createCollectionWithItems<TypedCollectionItemProvider>(
                [new CollectionDirectory(otherDirectory)],
                CollectionFormat.Bru,
                [],
                directory,
            );

        return { directory, otherDirectory, itemProvider };
    }

    async function runUpdate(
        directory: string,
        targetPosition: FileInsertionPosition,
        newFileName: string,
    ) {
        const { itemProvider } =
            createCollectionWithItems<TypedCollectionItemProvider>(
                [],
                CollectionFormat.Bru,
                [],
                directory,
            );

        await updateSequencesAfterInsertingRequestOrAppFile(
            itemProvider,
            targetPosition,
            join(directory, newFileName),
            { targetDirectory: directory },
        );
    }

    /** Sets the modification time of the files to a fixed time in the past, so that it can be detected afterwards whether they were written. */
    async function markAsUnmodified(directory: string, fileNames: string[]) {
        for (const name of fileNames) {
            await utimes(join(directory, name), unmodifiedTime, unmodifiedTime);
        }

        return fileNames;
    }

    async function getModifiedFiles(directory: string, fileNames: string[]) {
        const modified: string[] = [];

        for (const name of fileNames) {
            if (
                (await stat(join(directory, name))).mtime.getTime() !=
                unmodifiedTime.getTime()
            ) {
                modified.push(name);
            }
        }

        return modified;
    }
});

function requestFile(name: string, sequence: number) {
    return `meta {\n  name: ${name}\n  type: http\n  seq: ${sequence}\n}\n`;
}

function afterFile(sequence: number): FileInsertionPosition {
    return {
        type: RequestFileInsertionPositionType.AfterFile,
        item: { getSequence: () => sequence } as unknown as BrunoTreeItem,
    };
}

function mockSettings(settings: Record<string, unknown>) {
    jest.spyOn(workspace, "getConfiguration").mockReturnValue({
        get: (key: string) => settings[key],
    } as never);
}

async function getSequences(directory: string) {
    const sequences: Record<string, number> = {};

    for (const name of (await readdir(directory)).filter((name) =>
        name.endsWith(".bru"),
    )) {
        const content = await readFile(join(directory, name), "utf-8");
        sequences[name] = Number(/seq: (-?\d+)/.exec(content)?.[1]);
    }

    return sequences;
}
