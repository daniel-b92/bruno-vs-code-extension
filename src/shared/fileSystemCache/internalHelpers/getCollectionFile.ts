import {
    Collection,
    BrunoRequestFile,
    getItemType,
    getSequenceForFile,
    BrunoFileType,
    BrunoFolderSettingsFile,
    BrunoEnvironmentFile,
    NonBrunoSpecificItemType,
    NonBrunoFile,
} from "../..";

export async function getCollectionFile(collection: Collection, path: string) {
    const itemType = await getItemType(collection, path);

    if (!itemType) {
        throw new Error(`File '${path}' not available on file system.`);
    } else if (itemType == NonBrunoSpecificItemType.Directory) {
        throw new Error(
            `Cannot create collection file for directory '${path}'.`,
        );
    }

    switch (itemType) {
        case BrunoFileType.CollectionSettingsFile:
        case BrunoFileType.FolderSettingsFile:
            return new BrunoFolderSettingsFile(path);
        case BrunoFileType.EnvironmentFile:
            return new BrunoEnvironmentFile(path);
        case BrunoFileType.RequestFile:
            return new BrunoRequestFile(
                path,
                await getSequenceForFile(collection, path),
            );
        case NonBrunoSpecificItemType.OtherFileType:
            return new NonBrunoFile(path);
    }
}
