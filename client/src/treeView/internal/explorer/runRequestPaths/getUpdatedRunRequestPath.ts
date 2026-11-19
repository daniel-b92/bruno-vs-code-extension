export interface RunRequestPathRename {
    /** Relative to the collection root, without file extension (see `getRunRequestPathForItem`). */
    oldPath: string;
    newPath: string;
    isFile: boolean;
}

/**
 * Bruno joins the argument of `bru.runRequest` with the collection root, so a leading `./` or `/` is accepted.
 * It appends the request file extension if it is missing. Matching is case-sensitive.
 * The style of the referenced path (prefix and extension) is kept.
 *
 * Returns `undefined` if the referenced path is not affected by the rename.
 */
export function getUpdatedRunRequestPath(
    referencedPath: string,
    { oldPath, newPath, isFile }: RunRequestPathRename,
    requestFileExtension: string,
) {
    const prefix = /^(\.?\/)*/.exec(referencedPath)?.[0] ?? "";
    const withoutPrefix = referencedPath.substring(prefix.length);
    const hasExtension = withoutPrefix
        .toLowerCase()
        .endsWith(requestFileExtension.toLowerCase());
    const candidates = [
        { path: withoutPrefix, suffix: "" },
        ...(hasExtension
            ? [
                  {
                      path: withoutPrefix.slice(
                          0,
                          -requestFileExtension.length,
                      ),
                      suffix: withoutPrefix.slice(-requestFileExtension.length),
                  },
              ]
            : []),
    ];

    for (const { path, suffix } of candidates) {
        // A folder is only referenced via the requests below it. A path equal to the folder path would refer to a file with the same name.
        const updatedPath = isFile
            ? path == oldPath
                ? newPath
                : undefined
            : path.startsWith(`${oldPath}/`)
              ? newPath + path.substring(oldPath.length)
              : undefined;

        if (updatedPath != undefined) {
            return `${prefix}${updatedPath}${suffix}`;
        }
    }

    return undefined;
}
