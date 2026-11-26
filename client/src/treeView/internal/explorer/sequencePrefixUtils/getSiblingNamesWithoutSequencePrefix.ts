import { dirname } from "path";
import { normalizePath } from "@global_shared";
import { TypedCollection } from "@shared";
import { getNameWithoutSequencePrefix } from "./getNameWithoutSequencePrefix";

/**
 * The names (without sequence prefixes) of all files or all folders directly within the parent folder.
 * If names are prefixed with sequences, items whose names only differ in the prefix are not allowed, since their names would be the same without the prefixes,
 * e.g. in Bruno (the prefix is not part of the request name in the file) or after removing the prefixes (see `removeSequencePrefixesRecursively`).
 */
export async function getSiblingNamesWithoutSequencePrefix(
    collection: TypedCollection,
    parentFolder: string,
    options: {
        /** Whether to return the names of files or the ones of folders. */
        isFile: boolean;
        /** The item itself, if it exists already. */
        excludedPath?: string;
    },
) {
    const { isFile, excludedPath } = options;
    const siblings = collection
        .getAllStoredDataForCollection()
        .map(({ item }) => item)
        .filter(
            (item) =>
                item.isFile() == isFile &&
                normalizePath(dirname(item.getPath())) ==
                    normalizePath(parentFolder) &&
                (excludedPath === undefined ||
                    normalizePath(item.getPath()) !=
                        normalizePath(excludedPath)),
        );

    return await Promise.all(siblings.map(getNameWithoutSequencePrefix));
}
