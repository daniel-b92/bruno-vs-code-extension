import { resolve } from "path";
import { CollectionItemProvider } from "../../../../fileSystemCache/externalHelpers/collectionItemProvider";
import { readdirSync } from "fs";
import { getSequenceForFile } from "../../shared/getSequenceForFile";

export const getSequencesForRequests = (
    itemProvider: CollectionItemProvider,
    directory: string
): { path: string; sequence: number }[] => {
    const collection = itemProvider.getAncestorCollectionForPath(directory);

    if (!collection || !collection.getStoredDataForPath(directory)) {
        return [];
    }

    return readdirSync(directory)
        .map((childName) => {
            const fullPath = resolve(directory, childName);

            return {
                path: fullPath,
                sequence: getSequenceForFile(collection, fullPath),
            };
        })
        .filter(({ sequence }) => sequence != undefined) as {
        path: string;
        sequence: number;
    }[];
};
