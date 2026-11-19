import { extname, relative, resolve } from "path";
import {
    BrunoFileType,
    getFileExtensionForFormat,
    getRunRequestPathLiterals,
    isPathEqualOrDescendant,
    ItemType,
    Logger,
    NonBrunoSpecificItemType,
    Range,
} from "@global_shared";
import { TypedCollection } from "@shared";
import { getRunRequestPathForItem } from "./getRunRequestPathForItem";
import {
    getUpdatedRunRequestPath,
    RunRequestPathRename,
} from "./getUpdatedRunRequestPath";

export interface PathRename {
    /** Absolute paths. */
    sourcePath: string;
    targetPath: string;
    isFile: boolean;
}

export interface RunRequestPathEdit {
    /** The location of the file after all renames were applied. */
    filePath: string;
    range: Range;
    newText: string;
}

/**
 * Calculates the edits that are needed to keep the paths in `bru.runRequest` calls (of the same collection) up-to-date after renaming or moving requests and folders.
 *
 * The collection data must not be updated for the renames yet. The ranges refer to the file content before the renames,
 * the paths of the edits to the file locations after them.
 */
export async function getEditsForRunRequestPaths(
    collection: TypedCollection,
    renames: PathRename[],
    getFileContent: (path: string) => Promise<string | undefined>,
    logger?: Logger,
): Promise<RunRequestPathEdit[]> {
    const rootDirectory = collection.getRootDirectory();
    const format = collection.getFormat();
    const extension = getFileExtensionForFormat(format);

    const relevantRenames = renames.filter(
        ({ sourcePath, targetPath, isFile }) =>
            !collection.isRootDirectory(sourcePath) &&
            isPathEqualOrDescendant(sourcePath, rootDirectory) &&
            isPathEqualOrDescendant(targetPath, rootDirectory) &&
            (!isFile ||
                (collection
                    .getStoredDataForPath(sourcePath)
                    ?.item.getItemType() == BrunoFileType.RequestFile &&
                    extname(targetPath) == extension)),
    );

    if (relevantRenames.length == 0) {
        return [];
    }

    const runRequestRenames = relevantRenames.map(
        ({ sourcePath, targetPath, isFile }) => ({
            oldPath: getRunRequestPathForItem(
                rootDirectory,
                sourcePath,
                format,
                isFile,
            ),
            newPath: getRunRequestPathForItem(
                rootDirectory,
                targetPath,
                format,
                isFile,
            ),
            isFile,
        }),
    );

    const edits: RunRequestPathEdit[] = [];

    for (const { item } of collection.getAllStoredDataForCollection()) {
        const itemType = item.getItemType();
        const originalPath = item.getPath();

        if (!isFileToSearch(itemType, originalPath)) {
            continue;
        }

        const content = await getFileContent(originalPath);

        if (content == undefined) {
            continue;
        }

        const filePath = getPathAfterRenames(originalPath, relevantRenames);

        for (const literal of getRunRequestPathLiterals(
            content,
            itemType,
            format,
        )) {
            const newPath = getNewPath(
                literal.path,
                runRequestRenames,
                extension,
            );

            if (newPath == undefined) {
                continue;
            }

            const unsafeReason = getReasonForUnsafeText(newPath, literal);

            if (unsafeReason) {
                logger?.info(
                    `Did not update the path '${literal.path}' of a 'bru.runRequest' call in '${originalPath}' to '${newPath}', because it ${unsafeReason}.`,
                );
                continue;
            }

            edits.push({ filePath, range: literal.range, newText: newPath });
        }
    }

    return edits;
}

function isFileToSearch(itemType: ItemType, path: string) {
    return (
        !/(^|[\\/])node_modules[\\/]/.test(path) &&
        (itemType == BrunoFileType.RequestFile ||
            itemType == BrunoFileType.FolderSettingsFile ||
            itemType == BrunoFileType.CollectionSettingsFile ||
            (itemType == NonBrunoSpecificItemType.OtherFileType &&
                extname(path) == ".js"))
    );
}

export function getPathAfterRenames(path: string, renames: PathRename[]) {
    const rename = renames.find(({ sourcePath }) =>
        isPathEqualOrDescendant(path, sourcePath),
    );

    return rename
        ? resolve(rename.targetPath, relative(rename.sourcePath, path))
        : path;
}

function getNewPath(
    referencedPath: string,
    renames: RunRequestPathRename[],
    extension: string,
) {
    for (const rename of renames) {
        const updated = getUpdatedRunRequestPath(
            referencedPath,
            rename,
            extension,
        );

        if (updated != undefined) {
            return updated;
        }
    }

    return undefined;
}

function getReasonForUnsafeText(
    newPath: string,
    {
        quote,
        isInSingleLinePlainScalar,
    }: { quote: string; isInSingleLinePlainScalar: boolean },
) {
    if (newPath.includes(quote)) {
        return "contains the quote character of the string";
    }

    if (quote == "`" && newPath.includes("${")) {
        return "contains '${' within a template literal";
    }

    if (
        isInSingleLinePlainScalar &&
        (newPath.includes(": ") || newPath.includes(" #"))
    ) {
        return "would change the meaning of the single-line Yaml scalar";
    }

    return undefined;
}
