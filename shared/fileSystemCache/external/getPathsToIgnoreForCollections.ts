import { getTemporaryJsFileBasenameWithoutExtension } from "../..";

export function getPathsToIgnoreForCollections() {
    return [
        new RegExp(
            `(/|\\\\)${getTemporaryJsFileBasenameWithoutExtension()}\\.js`,
        ),
    ];
}
