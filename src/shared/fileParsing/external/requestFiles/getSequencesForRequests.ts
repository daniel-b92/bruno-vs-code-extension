import { resolve } from "path";
import { CollectionItemProvider } from "../../../fileSystemCache/externalHelpers/collectionItemProvider";
import { getSequenceForFile } from "../shared/getSequenceForFile";
import { promisify } from "util";
import { readdir } from "fs";

export const getSequencesForRequests = async (
    itemProvider: CollectionItemProvider,
    directory: string,
): Promise<{ path: string; sequence: number }[]> => {
    const collection = itemProvider.getAncestorCollectionForPath(directory);

    if (!collection || !collection.getStoredDataForPath(directory)) {
        return [];
    }

    return (
        await Promise.all(
            (await promisify(readdir)(directory)).map(async (childName) => {
                const fullPath = resolve(directory, childName);

                return {
                    path: fullPath,
                    sequence: await getSequenceForFile(collection, fullPath),
                };
            }),
        )
    ).filter(({ sequence }) => sequence != undefined) as {
        path: string;
        sequence: number;
    }[];
};
