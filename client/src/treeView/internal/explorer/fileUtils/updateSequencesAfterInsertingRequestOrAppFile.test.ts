import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { chmod, readFile } from "fs/promises";
import { join } from "path";
import { window } from "vscode";
import { CollectionDirectory, CollectionFormat } from "@global_shared";
import {
    createCollectionWithItems,
    getModifiedFiles,
    getRequestSequences,
    markFilesAsUnmodified,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { mockVsCodeSettings } from "../../../../_testingUtils";
import { BrunoTreeItem, TypedCollectionItemProvider } from "@shared";
import { updateSequencesAfterInsertingRequestOrAppFile } from "./updateSequencesAfterInsertingRequestOrAppFile";
import {
    FileInsertionPosition,
    RequestFileInsertionPositionType,
} from "./interfaces";

describe("updateSequencesAfterInsertingRequestOrAppFile", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

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
            const unmodifiedFiles = await markFilesAsUnmodified(directory, [
                "get-user.bru",
                "create-user.bru",
                "delete-user.bru",
            ]);

            await runUpdate(directory, afterFile(10), "new.bru");

            expect(await getRequestSequences(directory)).toEqual({
                "get-user.bru": 10,
                "new.bru": 15,
                "create-user.bru": 20,
                "delete-user.bru": 30,
            });
            expect(await getModifiedFiles(unmodifiedFiles)).toEqual([]);
        });

        it("only shifts the directly consecutive following files, if there is no gap after the target", async () => {
            const directory = await createTemporaryDirectory({
                "a.bru": requestFile("a", 1),
                "b.bru": requestFile("b", 2),
                "c.bru": requestFile("c", 3),
                "d.bru": requestFile("d", 10),
                "new.bru": requestFile("new", 1),
            });
            const unmodifiedFiles = await markFilesAsUnmodified(directory, [
                "a.bru",
                "d.bru",
            ]);

            await runUpdate(directory, afterFile(1), "new.bru");

            expect(await getRequestSequences(directory)).toEqual({
                "a.bru": 1,
                "new.bru": 2,
                "b.bru": 3,
                "c.bru": 4,
                "d.bru": 10,
            });
            expect(await getModifiedFiles(unmodifiedFiles)).toEqual([]);
        });

        it("considers app files like request files", async () => {
            const directory = await createTemporaryDirectory({
                "app.bru": "meta {\n  name: app\n  type: app\n  seq: 2\n}\n",
                "b.bru": requestFile("b", 3),
                "new.bru": requestFile("new", 1),
            });

            await runUpdate(directory, afterFile(2), "new.bru");

            expect(await getRequestSequences(directory)).toEqual({
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
            const unmodifiedFiles = await markFilesAsUnmodified(directory, [
                "a.bru",
                "b.bru",
            ]);

            await runUpdate(
                directory,
                RequestFileInsertionPositionType.Folder,
                "new.bru",
            );

            expect((await getRequestSequences(directory))["new.bru"]).toBe(8);
            expect(await getModifiedFiles(unmodifiedFiles)).toEqual([]);
        });

        it("appends the file with the highest sequence plus the configured step", async () => {
            mockVsCodeSettings({ "bru-as-code.sequenceStep": 10 });
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

            expect((await getRequestSequences(directory))["new.bru"]).toBe(30);
        });

        it("uses the sequence of the target plus the step, if the target is the last file", async () => {
            mockVsCodeSettings({ "bru-as-code.sequenceStep": 10 });
            const directory = await createTemporaryDirectory({
                "a.bru": requestFile("a", 10),
                "b.bru": requestFile("b", 20),
                "new.bru": requestFile("new", 1),
            });

            await runUpdate(directory, afterFile(20), "new.bru");

            expect((await getRequestSequences(directory))["new.bru"]).toBe(30);
        });

        it("ignores the previous sequence of a file that is moved within its directory", async () => {
            const directory = await createTemporaryDirectory({
                "a.bru": requestFile("a", 1),
                "b.bru": requestFile("b", 2),
                "c.bru": requestFile("c", 3),
            });
            const unmodifiedFiles = await markFilesAsUnmodified(directory, [
                "b.bru",
                "c.bru",
            ]);

            // Moves `a` behind `c`.
            await runUpdate(directory, afterFile(3), "a.bru");

            expect(await getRequestSequences(directory)).toEqual({
                "b.bru": 2,
                "c.bru": 3,
                "a.bru": 4,
            });
            expect(await getModifiedFiles(unmodifiedFiles)).toEqual([]);
        });

        it("reorders files within a directory by only shifting the necessary files", async () => {
            const directory = await createTemporaryDirectory({
                "a.bru": requestFile("a", 1),
                "b.bru": requestFile("b", 2),
                "c.bru": requestFile("c", 3),
            });

            // Moves `c` behind `a`.
            await runUpdate(directory, afterFile(1), "c.bru");

            expect(await getRequestSequences(directory)).toEqual({
                "a.bru": 1,
                "c.bru": 2,
                "b.bru": 3,
            });
        });

        it("does not modify the files of the directory that the file was moved away from", async () => {
            const { directory, otherDirectory, itemProvider } =
                await createDirectoriesForMovingFile();
            const unmodifiedFiles = await markFilesAsUnmodified(
                otherDirectory,
                ["x.bru", "z.bru"],
            );

            await updateSequencesAfterInsertingRequestOrAppFile(
                itemProvider,
                RequestFileInsertionPositionType.Folder,
                join(directory, "new.bru"),
                { targetDirectory: directory, otherDirectory },
            );

            expect(await getRequestSequences(otherDirectory)).toEqual({
                "x.bru": 1,
                "z.bru": 3,
            });
            expect(await getModifiedFiles(unmodifiedFiles)).toEqual([]);
        });
    });

    describe("with a yaml collection", () => {
        const format = CollectionFormat.Yaml;

        it("only changes the sequence of the inserted file, if there is a gap after the target", async () => {
            const directory = await createTemporaryDirectory({
                "get-user.yml": requestFile("get-user", 10, format),
                "create-user.yml": requestFile("create-user", 20, format),
                "new.yml": requestFile("new", 10, format),
            });
            const unmodifiedFiles = await markFilesAsUnmodified(directory, [
                "get-user.yml",
                "create-user.yml",
            ]);

            await runUpdate(directory, afterFile(10), "new.yml", format);

            expect(await getRequestSequences(directory)).toEqual({
                "get-user.yml": 10,
                "new.yml": 15,
                "create-user.yml": 20,
            });
            expect(await getModifiedFiles(unmodifiedFiles)).toEqual([]);
        });

        it("only shifts the directly consecutive following files, if there is no gap after the target", async () => {
            const directory = await createTemporaryDirectory({
                "a.yml": requestFile("a", 1, format),
                "b.yml": requestFile("b", 2, format),
                "c.yml": requestFile("c", 3, format),
                "d.yml": requestFile("d", 10, format),
                "new.yml": requestFile("new", 1, format),
            });
            const unmodifiedFiles = await markFilesAsUnmodified(directory, [
                "a.yml",
                "d.yml",
            ]);

            await runUpdate(directory, afterFile(1), "new.yml", format);

            expect(await getRequestSequences(directory)).toEqual({
                "a.yml": 1,
                "new.yml": 2,
                "b.yml": 3,
                "c.yml": 4,
                "d.yml": 10,
            });
            expect(await getModifiedFiles(unmodifiedFiles)).toEqual([]);
        });

        it("appends the file with the highest sequence plus the configured step, if the target is a folder", async () => {
            mockVsCodeSettings({ "bru-as-code.sequenceStep": 10 });
            const directory = await createTemporaryDirectory({
                "a.yml": requestFile("a", 10, format),
                "b.yml": requestFile("b", 20, format),
                "new.yml": requestFile("new", 1, format),
            });

            await runUpdate(
                directory,
                RequestFileInsertionPositionType.Folder,
                "new.yml",
                format,
            );

            expect((await getRequestSequences(directory))["new.yml"]).toBe(30);
        });
    });

    it.each<[string, FileInsertionPosition]>([
        ["a file", afterFile(1)],
        ["the folder", RequestFileInsertionPositionType.Folder],
    ])(
        "does not change any sequences, if the inserted file has none and the target is %s",
        async (_, targetPosition) => {
            const directory = await createTemporaryDirectory({
                "a.bru": requestFile("a", 1),
                "b.bru": requestFile("b", 2),
                "new.bru": "meta {\n  name: new\n  type: http\n}\n",
            });
            const unmodifiedFiles = await markFilesAsUnmodified(directory, [
                "a.bru",
                "b.bru",
                "new.bru",
            ]);

            await runUpdate(directory, targetPosition, "new.bru");

            expect(await getModifiedFiles(unmodifiedFiles)).toEqual([]);
        },
    );

    it.each([
        [CollectionFormat.Bru, "new.bru", "get {\n}\n"],
        [CollectionFormat.Yaml, "new.yml", "info: {}\n"],
    ])(
        "shows an error if the replaced sequence cannot be set (%s)",
        async (format, fileName, content) => {
            const showErrorMessage = jest
                .spyOn(window, "showErrorMessage")
                .mockResolvedValue(undefined);
            const directory = await createTemporaryDirectory({
                [fileName]: content,
            });

            await runUpdate(
                directory,
                RequestFileInsertionPositionType.Folder,
                fileName,
                format,
                20,
            );

            expect(showErrorMessage.mock.calls[0]?.[0]).toContain(fileName);
            expect(await readFile(join(directory, fileName), "utf-8")).toBe(
                content,
            );
        },
    );

    it("shows only one error if the sequence cannot be written", async () => {
        const showErrorMessage = jest
            .spyOn(window, "showErrorMessage")
            .mockResolvedValue(undefined);
        const directory = await createTemporaryDirectory({
            "new.bru": requestFile("new", 1),
        });
        await chmod(join(directory, "new.bru"), 0o444);

        await runUpdate(
            directory,
            RequestFileInsertionPositionType.Folder,
            "new.bru",
            CollectionFormat.Bru,
            20,
        );

        expect(showErrorMessage).toHaveBeenCalledTimes(1);
        expect(showErrorMessage.mock.calls[0]?.[0]).toContain("new.bru");
    });

    describe("with automatic renumbering enabled", () => {
        it("renumbers the target directory with the configured step", async () => {
            mockVsCodeSettings({
                "bru-as-code.renumberSequencesAutomatically": true,
                "bru-as-code.sequenceStep": 10,
            });
            const directory = await createTemporaryDirectory({
                "a.bru": requestFile("a", 3),
                "b.bru": requestFile("b", 40),
                "new.bru": requestFile("new", 1),
            });

            await runUpdate(directory, afterFile(3), "new.bru");

            expect(await getRequestSequences(directory)).toEqual({
                "a.bru": 10,
                "new.bru": 20,
                "b.bru": 30,
            });
        });

        it("renumbers the directory that the file was moved away from", async () => {
            mockVsCodeSettings({
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

            expect(await getRequestSequences(otherDirectory)).toEqual({
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
        format = CollectionFormat.Bru,
        replacedSequence?: number,
    ) {
        const { itemProvider } =
            createCollectionWithItems<TypedCollectionItemProvider>(
                [],
                format,
                [],
                directory,
            );

        await updateSequencesAfterInsertingRequestOrAppFile(
            itemProvider,
            targetPosition,
            join(directory, newFileName),
            { targetDirectory: directory },
            replacedSequence,
        );
    }
});

function requestFile(
    name: string,
    sequence: number,
    format = CollectionFormat.Bru,
) {
    return format == CollectionFormat.Yaml
        ? `info:\n  name: ${name}\n  type: http\n  seq: ${sequence}\n\nhttp:\n  method: GET\n  url: ""\n`
        : `meta {\n  name: ${name}\n  type: http\n  seq: ${sequence}\n}\n`;
}

function afterFile(sequence: number): FileInsertionPosition {
    return {
        type: RequestFileInsertionPositionType.AfterFile,
        item: new BrunoTreeItem(
            `file-with-sequence-${sequence}`,
            true,
            false,
            sequence,
        ),
    };
}
