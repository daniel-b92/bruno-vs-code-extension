import { getTemporaryJsFileBasenameWithoutExtension } from "../..";

export function getPathsToIgnoreForCollections() {
    return [
        // TODO: Remove this special treatment of leftover temporary js files at some point in the future, once versions of the extension that created them are no longer in use.
        new RegExp(
            `(/|\\\\)${getTemporaryJsFileBasenameWithoutExtension()}\\.js`,
        ),
    ];
}
