import { normalizePath, isCollectionDirectory } from "@global_shared";
import { dirname } from "path";
import { TypedCollectionItemProvider } from "../../interfaces";

export function getSequencesForOtherFoldersWithSameParent(
    itemProvider: TypedCollectionItemProvider,
    folderSettingsFile: string,
): {
    folderSettingsFile: string;
    folderPath: string;
    sequence: number;
}[] {
    const collection =
        itemProvider.getAncestorCollectionForPath(folderSettingsFile);

    if (!collection) {
        console.warn(
            `Could not determine collection for folder settings path '${folderSettingsFile}'`,
        );
        return [];
    }

    return collection
        .getAllStoredDataForCollection()
        .map(({ item }) => item)
        .filter(isCollectionDirectory)
        .filter(
            (directory) =>
                normalizePath(dirname(directory.getPath())) ==
                    normalizePath(dirname(dirname(folderSettingsFile))) &&
                directory.getSequence() != undefined &&
                normalizePath(directory.getPath()) !=
                    normalizePath(dirname(folderSettingsFile)),
        )
        .map((directory) => ({
            // Only if there is a folder settings file, the folder can have a valid sequence.
            folderSettingsFile: directory.getSettingsFilePath() as string,
            folderPath: directory.getPath(),
            sequence: directory.getSequence() as number,
        }));
}
