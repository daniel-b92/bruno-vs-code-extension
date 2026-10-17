import {
    normalizePath,
    BrunoFileType,
    isCollectionItemWithSequence,
} from "@global_shared";
import { dirname } from "path";
import { TypedCollectionItemProvider } from "../../interfaces";

export function getSequencesForOtherRequestsInFolder(
    itemProvider: TypedCollectionItemProvider,
    filePath: string,
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
            item.getItemType() == BrunoFileType.RequestFile
            ? [{ file: item.getPath(), sequence }]
            : [];
    });
}
