import { extname, relative, resolve } from "path";
import {
    BrunoFileType,
    getFileExtensionForFormat,
    getItemType,
    getRunRequestPathLiterals,
    isPathEqualOrDescendant,
    ItemType,
    Logger,
    NonBrunoSpecificItemType,
    normalizePath,
    Range,
} from "@global_shared";
import { TypedCollection } from "@shared";
import { getRunRequestPathForItem } from "./getRunRequestPathForItem";
import { getUpdatedRunRequestPath } from "./getUpdatedRunRequestPath";
import { applyRenamesToPath, getPathDepth } from "./applyRenamesToPath";

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
 * The renames are treated as if they were executed at once (see `applyRenamesToPath`).
 *
 * The collection data must not be updated for the renames yet. The ranges refer to the file content before the renames,
 * the paths of the edits to the file locations after them.
 *
 * @param previousRenames Renames that were executed before, but are not reflected in the collection data yet. They are needed for finding the files that are cached with their old paths.
 */
export async function getEditsForRunRequestPaths(
    collection: TypedCollection,
    renames: PathRename[],
    getFileContent: (path: string) => Promise<string | undefined>,
    logger?: Logger,
    previousRenames: PathRename[] = [],
): Promise<RunRequestPathEdit[]> {
    const rootDirectory = collection.getRootDirectory();
    const format = collection.getFormat();
    const extension = getFileExtensionForFormat(format);

    const relevantRenames: PathRename[] = [];

    for (const rename of renames) {
        if (await isRelevantRename(collection, rename, extension)) {
            relevantRenames.push(rename);
        }
    }

    if (relevantRenames.length == 0) {
        return [];
    }

    const runRequestRenames = relevantRenames.map(
        ({ sourcePath, targetPath, isFile }) => ({
            depth: getPathDepth(sourcePath),
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

    const edits = new Map<string, RunRequestPathEdit>();

    for (const { item } of collection.getAllStoredDataForCollection()) {
        const itemType = item.getItemType();
        // Files that were moved by a previous rename may still be cached with their old path.
        const originalPath = getPathAfterRenames(
            item.getPath(),
            previousRenames,
        );

        if (
            // A file that was moved into another collection may still be cached here, but the renames of this collection do not affect it.
            !isPathEqualOrDescendant(originalPath, rootDirectory) ||
            !isFileToSearch(itemType, originalPath)
        ) {
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
            const newPath = applyRenamesToPath(
                literal.path,
                runRequestRenames,
                (path, rename) =>
                    getUpdatedRunRequestPath(path, rename, extension),
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

            const { start, end } = literal.range;

            // The same file can be found twice if the collection data was updated for a previous rename in the meantime.
            edits.set(
                `${normalizePath(filePath)}:${start.line}:${start.character}:${end.line}:${end.character}`,
                { filePath, range: literal.range, newText: newPath },
            );
        }
    }

    return Array.from(edits.values());
}

async function isRelevantRename(
    collection: TypedCollection,
    { sourcePath, targetPath, isFile }: PathRename,
    extension: string,
) {
    const rootDirectory = collection.getRootDirectory();

    if (
        // E.g. when changing the sequence of a request via drag-and-drop within the same folder.
        normalizePath(sourcePath) == normalizePath(targetPath) ||
        collection.isRootDirectory(sourcePath) ||
        !isPathEqualOrDescendant(sourcePath, rootDirectory) ||
        !isPathEqualOrDescendant(targetPath, rootDirectory)
    ) {
        return false;
    }

    return (
        !isFile ||
        (extname(targetPath) == extension &&
            // The collection data may not know the file yet if it was moved or created shortly before.
            (collection.getStoredDataForPath(sourcePath)?.item.getItemType() ??
                (await getItemType(collection, sourcePath))) ==
                BrunoFileType.RequestFile)
    );
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

/** The location of the item with the given path after all renames (see `applyRenamesToPath`). */
export function getPathAfterRenames(path: string, renames: PathRename[]) {
    return (
        applyRenamesToPath(
            path,
            renames.map((rename) => ({
                ...rename,
                depth: getPathDepth(rename.sourcePath),
            })),
            (currentPath, { sourcePath, targetPath }) =>
                isPathEqualOrDescendant(currentPath, sourcePath)
                    ? resolve(targetPath, relative(sourcePath, currentPath))
                    : undefined,
        ) ?? path
    );
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
