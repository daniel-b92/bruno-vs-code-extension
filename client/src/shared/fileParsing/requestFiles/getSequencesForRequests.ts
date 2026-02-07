import { resolve } from "path";
import { TypedCollectionItemProvider, getSequenceForFile } from "@shared";
import { promisify } from "util";
import { readdir } from "fs";

export const getSequencesForRequests = async (
    itemProvider: TypedCollectionItemProvider,
    directory: string,
): Promise<{ path: string; sequence: number }[]> => {
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
                            sequence: await getSequenceForFile(
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
};
