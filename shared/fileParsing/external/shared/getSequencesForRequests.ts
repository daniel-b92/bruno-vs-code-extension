import { resolve } from "path";
import { promisify } from "util";
import { readdir } from "fs";
import { CollectionItemProvider, getSequenceForFile } from "../../..";

export async function getSequencesForRequests<T>(
    itemProvider: CollectionItemProvider<T>,
    directory: string,
): Promise<{ path: string; sequence: number }[]> {
    const collection = itemProvider.getAncestorCollectionForPath(directory);

    if (!collection || !collection.getStoredDataForPath(directory)) {
        return [];
    }

    return (
        await Promise.all(
            await promisify(readdir)(directory)
                .then((childNames) =>
                    childNames.map(async (childName) => {
                        const fullPath = resolve(directory, childName);

                        return {
                            path: fullPath,
                            sequence: await getSequenceForFile<T>(
                                collection,
                                fullPath,
                            ),
                        };
                    }),
                )
                .catch(() => []),
        )
    ).filter(({ sequence }) => sequence != undefined) as {
        path: string;
        sequence: number;
    }[];
}
