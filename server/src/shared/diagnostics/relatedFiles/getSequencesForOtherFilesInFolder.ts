import {
    normalizePath,
    BrunoFileType,
    isCollectionItemWithSequence,
} from "@global_shared";
import { dirname } from "path";
import { TypedCollectionItemProvider } from "../../interfaces";

/** Returns the sequences of all other files in the same folder, that are of one of the given types. */
export function getSequencesForOtherFilesInFolder(
    itemProvider: TypedCollectionItemProvider,
    filePath: string,
    itemTypes: BrunoFileType[],
): { file: string; sequence: number }[] {
    const directoryPath = dirname(filePath);
    const collection = itemProvider.getAncestorCollectionForPath(directoryPath);

    if (!collection) {
        console.warn(
            `Could not determine collection for directory path '${directoryPath}'`,
        );
        return [];
    }

    return collection.getAllStoredDataForCollection().flatMap(({ item }) => {
        const sequence = isCollectionItemWithSequence(item)
            ? item.getSequence()
            : undefined;

        return sequence != undefined &&
            item.isFile() &&
            normalizePath(dirname(item.getPath())) ==
                normalizePath(directoryPath) &&
            normalizePath(item.getPath()) != normalizePath(filePath) &&
            itemTypes.includes(item.getItemType() as BrunoFileType)
            ? [{ file: item.getPath(), sequence }]
            : [];
    });
}
