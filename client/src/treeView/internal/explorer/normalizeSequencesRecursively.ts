import { readdir } from "fs/promises";
import { resolve } from "path";
import { normalizePath } from "@global_shared";
import { TypedCollectionItemProvider } from "../../../shared";
import { normalizeSequencesForRequestsAndAppFiles } from "./fileUtils/normalizeSequencesForRequestsAndAppFiles";
import { normalizeSequencesForFolders } from "./folderUtils/normalizeSequencesForFolders";

export async function normalizeSequencesRecursively(
    itemProvider: TypedCollectionItemProvider,
    folderPath: string,
    collectionRootPath: string,
    sequenceStep: number,
) {
    await normalizeSequencesForRequestsAndAppFiles(
        itemProvider,
        folderPath,
        sequenceStep,
        true,
    );
    await normalizeSequencesForFolders(
        itemProvider,
        folderPath,
        sequenceStep,
        true,
    );

    const childFolders = await readdir(folderPath, { withFileTypes: true })
        .then((entries) =>
            entries
                .filter((entry) => entry.isDirectory())
                .map((entry) => resolve(folderPath, entry.name)),
        )
        .catch(() => []);

    for (const childFolderPath of childFolders) {
        const childCollection =
            itemProvider.getAncestorCollectionForPath(childFolderPath);
        if (
            !childCollection ||
            normalizePath(childCollection.getRootDirectory()) !==
                normalizePath(collectionRootPath)
        ) {
            continue;
        }

        await normalizeSequencesRecursively(
            itemProvider,
            childFolderPath,
            collectionRootPath,
            sequenceStep,
        );
    }
}
