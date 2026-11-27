import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { mkdir } from "fs/promises";
import { join } from "path";
import {
    BrunoFileType,
    CollectionFormat,
    ItemType,
    NonBrunoSpecificItemType,
} from "@global_shared";
import {
    createItemProviderStub,
    folderSettingsContent,
    getFolderSequences,
    useTemporaryDirectories,
} from "@global_shared/_testingUtils";
import { TypedCollectionItemProvider } from "@shared";
import { mockVsCodeSettings } from "../../../_testingUtils";
import { updateSequencesAfterDeletingItem } from "./updateSequencesAfterDeletingItem";

describe("updateSequencesAfterDeletingItem", () => {
    const createTemporaryDirectory = useTemporaryDirectories();

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it.each([CollectionFormat.Bru, CollectionFormat.Yaml])(
        "renumbers the remaining folders after deleting a folder in a %s collection",
        async (format) => {
            mockVsCodeSettings({
                "bru-as-code.renumberSequencesAutomatically": true,
            });
            const directory = await createRemainingFolders(format);

            await deleteFolderA(directory, format);

            expect(await getFolderSequences(directory, format)).toEqual({
                b: 1,
                c: 2,
            });
        },
    );

    it("renumbers with the configured step", async () => {
        mockVsCodeSettings({
            "bru-as-code.renumberSequencesAutomatically": true,
            "bru-as-code.sequenceStep": 10,
        });
        const directory = await createRemainingFolders(CollectionFormat.Bru);

        await deleteFolderA(directory, CollectionFormat.Bru);

        expect(
            await getFolderSequences(directory, CollectionFormat.Bru),
        ).toEqual({ b: 10, c: 20 });
    });

    it("renumbers the folders after deleting a folder settings file", async () => {
        mockVsCodeSettings({
            "bru-as-code.renumberSequencesAutomatically": true,
        });
        const directory = await createRemainingFolders(CollectionFormat.Bru);
        // Only the settings file has been deleted, the folder itself still exists.
        await mkdir(join(directory, "a"));

        await deleteItem(directory, CollectionFormat.Bru, {
            path: join(directory, "a", "folder.bru"),
            itemType: BrunoFileType.FolderSettingsFile,
            sequence: 1,
        });

        expect(
            await getFolderSequences(directory, CollectionFormat.Bru),
        ).toEqual({ b: 1, c: 2 });
    });

    it("keeps the sequences if renumbering is not enabled", async () => {
        mockVsCodeSettings({});
        const directory = await createRemainingFolders(CollectionFormat.Bru);

        await deleteFolderA(directory, CollectionFormat.Bru);

        expect(
            await getFolderSequences(directory, CollectionFormat.Bru),
        ).toEqual({ b: 2, c: 3 });
    });

    it("keeps the sequences after deleting a folder without a sequence", async () => {
        mockVsCodeSettings({
            "bru-as-code.renumberSequencesAutomatically": true,
        });
        const directory = await createRemainingFolders(CollectionFormat.Bru);

        await deleteItem(directory, CollectionFormat.Bru, {
            path: join(directory, "a"),
            itemType: NonBrunoSpecificItemType.Directory,
            sequence: undefined,
        });

        expect(
            await getFolderSequences(directory, CollectionFormat.Bru),
        ).toEqual({ b: 2, c: 3 });
    });

    /** The folders that are left after deleting the folder `a` with the sequence 1. */
    async function createRemainingFolders(format: CollectionFormat) {
        const fileName =
            format == CollectionFormat.Yaml ? "folder.yml" : "folder.bru";

        return await createTemporaryDirectory({
            [`b/${fileName}`]: folderSettingsContent(format, "b", 2),
            [`c/${fileName}`]: folderSettingsContent(format, "c", 3),
        });
    }
});

async function deleteFolderA(directory: string, format: CollectionFormat) {
    await deleteItem(directory, format, {
        path: join(directory, "a"),
        itemType: NonBrunoSpecificItemType.Directory,
        sequence: 1,
    });
}

/** The directory is used as the collection root and as the parent folder of the deleted item. */
async function deleteItem(
    directory: string,
    format: CollectionFormat,
    deletedItem: {
        path: string;
        itemType: ItemType;
        sequence: number | undefined;
    },
) {
    await updateSequencesAfterDeletingItem(
        createItemProviderStub<TypedCollectionItemProvider>(directory, format),
        deletedItem,
        directory,
        new Map(),
    );
}
