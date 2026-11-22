import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { join } from "path";
import { rename } from "fs/promises";
import { workspace, WorkspaceEdit } from "vscode";
import {
    BrunoRequestFile,
    CollectionDirectory,
    CollectionFormat,
    checkIfPathExistsAsync,
} from "@global_shared";
import {
    createCollectionWithItems,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "@shared";
import { mockVsCodeSettings } from "../../../../_testingUtils";
import {
    getPathAfterSequencePrefixSync,
    syncSequencePrefixes,
} from "./syncSequencePrefixes";

describe("syncSequencePrefixes", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("does nothing if names should not be prefixed with the sequence", async () => {
        mockVsCodeSettings({ "bru-as-code.sequenceStep": 10 });
        const applyEdit = jest.spyOn(workspace, "applyEdit");
        const { directory, itemProvider } = await setUpCollection(
            createTemporaryDirectory,
        );

        const renamed = await syncSequencePrefixes(itemProvider, [directory]);

        expect(renamed.size).toBe(0);
        expect(applyEdit).not.toHaveBeenCalled();
    });

    it("prefixes requests and folders with their sequence", async () => {
        mockVsCodeSettings({
            "bru-as-code.prefixNamesWithSequence": true,
            "bru-as-code.sequenceStep": 10,
        });
        jest.spyOn(workspace, "applyEdit").mockImplementation(applyRenames);
        const { directory, itemProvider } = await setUpCollection(
            createTemporaryDirectory,
        );

        const renamed = await syncSequencePrefixes(itemProvider, [directory]);

        expect(
            await Promise.all(
                [
                    "0010_first.bru",
                    "0020_users",
                    "0025_second.bru",
                    "no-sequence.bru",
                ].map((name) => checkIfPathExistsAsync(join(directory, name))),
            ),
        ).toEqual([true, true, true, true]);
        expect(
            getPathAfterSequencePrefixSync(
                join(directory, "first.bru"),
                renamed,
            ),
        ).toBe(join(directory, "0010_first.bru"));
    });

    it("replaces outdated prefixes", async () => {
        mockVsCodeSettings({
            "bru-as-code.prefixNamesWithSequence": true,
            "bru-as-code.sequenceStep": 10,
        });
        jest.spyOn(workspace, "applyEdit").mockImplementation(applyRenames);
        const { directory, itemProvider } = await setUpCollection(
            createTemporaryDirectory,
            { first: "0050_first.bru" },
        );

        await syncSequencePrefixes(itemProvider, [directory]);

        expect(
            await checkIfPathExistsAsync(join(directory, "0010_first.bru")),
        ).toBe(true);
        expect(
            await checkIfPathExistsAsync(join(directory, "0050_first.bru")),
        ).toBe(false);
    });

    it("does not overwrite existing items", async () => {
        mockVsCodeSettings({
            "bru-as-code.prefixNamesWithSequence": true,
            "bru-as-code.sequenceStep": 10,
        });
        const applyEdit = jest
            .spyOn(workspace, "applyEdit")
            .mockImplementation(applyRenames);
        const { directory, itemProvider } = await setUpCollection(
            createTemporaryDirectory,
            { first: "first.bru", extraFiles: ["0010_first.bru"] },
        );

        const renamed = await syncSequencePrefixes(itemProvider, [directory]);

        expect(renamed.has(join(directory, "first.bru"))).toBe(false);
        expect(await checkIfPathExistsAsync(join(directory, "first.bru"))).toBe(
            true,
        );
        // Only the other items are renamed.
        expect(applyEdit).toHaveBeenCalledTimes(2);
    });
});

async function setUpCollection(
    createTemporaryDirectory: ReturnType<typeof useTemporaryDirectories>,
    options: { first?: string; extraFiles?: string[] } = {},
) {
    const firstFileName = options.first ?? "first.bru";
    const directory = await createTemporaryDirectory({
        [firstFileName]: requestContent("first", 10),
        "second.bru": requestContent("second", 25),
        "no-sequence.bru": "meta {\n  name: no-sequence\n  type: http\n}\n",
        "users/folder.bru": "meta {\n  name: users\n  seq: 20\n}\n",
        ...Object.fromEntries(
            (options.extraFiles ?? []).map((name) => [name, "x"]),
        ),
    });
    const { itemProvider } =
        createCollectionWithItems<TypedCollectionItemProvider>(
            [
                new BrunoRequestFile(join(directory, firstFileName), 10),
                new BrunoRequestFile(join(directory, "second.bru"), 25),
                new CollectionDirectory(
                    join(directory, "users"),
                    join(directory, "users", "folder.bru"),
                    20,
                ),
            ],
            CollectionFormat.Bru,
            [],
            directory,
        );

    return { directory, itemProvider };
}

function requestContent(name: string, sequence: number) {
    return `meta {\n  name: ${name}\n  type: http\n  seq: ${sequence}\n}\n`;
}

/** The mocked `workspace.applyEdit` does not apply any edits, so the renames are applied here. */
async function applyRenames(edit: unknown) {
    for (const { from, to } of (
        edit as WorkspaceEdit & {
            renames: { from: { fsPath: string }; to: { fsPath: string } }[];
        }
    ).renames) {
        await rename(from.fsPath, to.fsPath);
    }
    return true;
}
