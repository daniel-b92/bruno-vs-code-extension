import { checkIfPathExistsAsync, Logger, normalizePath } from "@global_shared";
import { PathRename } from "./runRequestPaths/getEditsForRunRequestPaths";

/**
 * Removes the renames that would overwrite an item. A target path counts as free if it is the source path of another rename (which is then executed first),
 * but not if it is taken by an item that stays or if another rename uses the same target path (then only the first of them is kept).
 */
export async function excludeConflictingRenames(
    renames: PathRename[],
    logger?: Logger,
) {
    let remaining = renames.filter(
        ({ sourcePath, targetPath }) =>
            normalizePath(sourcePath) != normalizePath(targetPath),
    );
    let conflictFound = true;

    // Excluding a rename can cause a conflict for another one, whose target was supposed to be vacated.
    while (conflictFound) {
        conflictFound = false;
        const sources = new Set(
            remaining.map(({ sourcePath }) => normalizePath(sourcePath)),
        );
        const usedTargets = new Set<string>();

        for (const rename of remaining) {
            const target = normalizePath(rename.targetPath);

            if (
                usedTargets.has(target) ||
                (!sources.has(target) &&
                    (await checkIfPathExistsAsync(rename.targetPath)))
            ) {
                logger?.warn(
                    `Did not rename '${rename.sourcePath}' to '${rename.targetPath}', because an item with this name already exists.`,
                );
                remaining = remaining.filter((other) => other !== rename);
                conflictFound = true;
                break;
            }

            usedTargets.add(target);
        }
    }

    return remaining;
}
