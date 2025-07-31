import {
    Collection,
    CollectionFile,
    getFileType,
    getSequenceForFile,
} from "../..";

export async function getCollectionFile(collection: Collection, path: string) {
    const fileType = await getFileType(collection, path);

    if (!fileType) {
        throw new Error(`File '${path}' not available on file system`);
    }

    return new CollectionFile(
        path,
        fileType,
        await getSequenceForFile(collection, path),
    );
}
