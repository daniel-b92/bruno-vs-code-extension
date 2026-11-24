export interface RenameWithDepth {
    /** The number of segments of the path of the renamed item (before the rename). */
    depth: number;
}

export function getPathDepth(path: string) {
    return path.split(/[\\/]/).filter((segment) => segment != "").length;
}

/**
 * Maps a path as if all given renames were executed at once:
 * - Renames of nested items take effect before the ones of their ancestors, which refer to the paths before all renames.
 * - A path is renamed at most once per nesting level, so renaming `a` to `b` and `b` to `c` does not turn `a` into `c`.
 *
 * `applyRename` returns `undefined` if the rename does not affect the given path.
 * @returns `undefined` if none of the renames affects the path.
 */
export function applyRenamesToPath<R extends RenameWithDepth>(
    path: string,
    renames: R[],
    applyRename: (path: string, rename: R) => string | undefined,
) {
    let result: string | undefined = undefined;
    const depths = Array.from(new Set(renames.map(({ depth }) => depth))).sort(
        (a, b) => b - a,
    );

    for (const depth of depths) {
        for (const rename of renames.filter((r) => r.depth == depth)) {
            const updated = applyRename(result ?? path, rename);

            if (updated !== undefined) {
                result = updated;
                break;
            }
        }
    }

    return result;
}
