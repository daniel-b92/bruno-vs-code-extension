import { getSequencesForRequestsAndAppFiles } from "@global_shared";
import { getSequencesForFolders, TypedCollectionItemProvider } from "@shared";

export interface ItemWithSequence {
    path: string;
    sequence: number;
    /** The file that contains the stored name (and the sequence) of the item. */
    fileWithStoredName: string;
    isFile: boolean;
}

/** The requests, app files and folders directly within the given folder that have a sequence. */
export async function getItemsWithSequence(
    itemProvider: TypedCollectionItemProvider,
    folderPath: string,
): Promise<ItemWithSequence[]> {
    return [
        ...(
            await getSequencesForRequestsAndAppFiles(itemProvider, folderPath)
        ).map(({ path, sequence }) => ({
            path,
            sequence,
            fileWithStoredName: path,
            isFile: true,
        })),
        ...(await getSequencesForFolders(itemProvider, folderPath)).map(
            ({ folderPath: path, settingsFile, sequence }) => ({
                path,
                sequence,
                fileWithStoredName: settingsFile,
                isFile: false,
            }),
        ),
    ];
}
