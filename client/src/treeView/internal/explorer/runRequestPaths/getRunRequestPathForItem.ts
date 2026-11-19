import { relative, sep } from "path";
import { CollectionFormat, getFileExtensionForFormat } from "@global_shared";

/**
 * The path, as it is used in `bru.runRequest`: relative to the collection root, with `/` as separator and without the file extension of requests.
 */
export function getRunRequestPathForItem(
    collectionRoot: string,
    itemPath: string,
    format: CollectionFormat,
    isFile: boolean,
) {
    const relativePath = relative(collectionRoot, itemPath)
        .split(sep)
        .join("/");
    const extension = getFileExtensionForFormat(format);

    return isFile && relativePath.endsWith(extension)
        ? relativePath.slice(0, -extension.length)
        : relativePath;
}
