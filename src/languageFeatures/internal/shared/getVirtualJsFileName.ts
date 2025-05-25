import { basename, extname, resolve } from "path";

export function getVirtualJsFileName(
    collectionRootDirectory: string,
    bruFileName: string
) {
    const oldBaseName = basename(bruFileName);
    return resolve(
        collectionRootDirectory,
        oldBaseName.replace(extname(oldBaseName), ".js")
    );
}
