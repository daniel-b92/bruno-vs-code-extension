import { describe, it, expect } from "@jest/globals";
import { readFile } from "fs/promises";
import { join } from "path";
import { CollectionFormat } from "@global_shared";
import {
    createItemProviderStub,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { BrunoTreeItem, TypedCollectionItemProvider } from "@shared";
import { FolderDropInsertionOption } from "../folderDropInsertionOptionEnum";
import { updateSequencesAfterMovingFolder } from "./updateSequencesAfterMovingFolder";

describe("updateSequencesAfterMovingFolder", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    describe("folder settings of the moved folder", () => {
        const otherSettings = "vars:pre-request {\n  keepMe: 1\n}\n";

        it("keeps all other settings when moving within the same parent", async () => {
            const directory = await createTemporaryDirectory({
                "a/folder.bru": `${folderSettingsFile("a", 1)}\n${otherSettings}`,
                "b/folder.bru": folderSettingsFile("b", 2),
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

            // The sequences are normalized afterwards.
            expect(await readSettings(directory, "a")).toBe(
                `${folderSettingsFile("a", 2)}\n${otherSettings}`,
            );
            expect(await readSettings(directory, "b")).toBe(
                folderSettingsFile("b", 1),
            );
        });

        it("updates the settings at the new location and does not create anything at the old location, when moving to another parent", async () => {
            const directory = await createTemporaryDirectory({
                "new/b/folder.bru": folderSettingsFile("b", 2),
                "new/moved/folder.bru": `${folderSettingsFile("moved", 9)}\n${otherSettings}`,
            });

            await updateSequencesAfterMovingFolder(
                createItemProviderStub<TypedCollectionItemProvider>(
                    directory,
                    CollectionFormat.Bru,
                ),
                // The folder was already moved from its old location `old/moved`.
                join(directory, "old", "moved"),
                treeItem(join(directory, "new", "b"), 2),
                FolderDropInsertionOption.InsertAfterTarget,
            );

            expect(await readSettings(directory, "new/moved")).toBe(
                `${folderSettingsFile("moved", 3)}\n${otherSettings}`,
            );
            expect(await readSettings(directory, "old/moved")).toBeUndefined();
        });
    });
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

async function readSettings(directory: string, folder: string) {
    return await readFile(join(directory, folder, "folder.bru"), "utf-8").catch(
        () => undefined,
    );
}
