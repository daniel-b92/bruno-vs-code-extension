import { lstat } from "fs/promises";
import { basename, dirname, resolve } from "path";
import { isPathEqualOrDescendant, normalizePath } from "@global_shared";

export type MoveTarget =
    | { kind: "move"; newPath: string; isFile: boolean }
    /** The item is already located in the target folder. */
    | { kind: "unchanged" }
    | { kind: "rejected"; message: string };

/**
 * Determines the new path of an item that is moved via drag and drop, without any logic that is specific to Bruno collections (e.g. for sequences).
 * An item is always moved into the target folder. If the target is a file, its parent folder is used.
 */
export async function getTargetPathForMovingItem(
    sourcePath: string,
    target: { path: string; isFile: boolean },
): Promise<MoveTarget> {
    const sourceStats = await lstat(sourcePath).catch(() => undefined);

    if (!sourceStats) {
        return {
            kind: "rejected",
            message: `The item '${sourcePath}' does not exist anymore.`,
        };
    }

    const isFile = !sourceStats.isDirectory();

    if (!isFile && target.isFile) {
        return {
            kind: "rejected",
            message:
                "Cannot use a file as a target for moving a folder to. Please select a folder instead.",
        };
    }

    if (!isFile && isPathEqualOrDescendant(target.path, sourcePath)) {
        return {
            kind: "rejected",
            message:
                "Cannot use a descendant item as a target for moving a folder to. Please select a different target folder.",
        };
    }

    const newPath = resolve(
        target.isFile ? dirname(target.path) : target.path,
        basename(sourcePath),
    );

    return normalizePath(newPath) == normalizePath(sourcePath)
        ? { kind: "unchanged" }
        : { kind: "move", newPath, isFile };
}
