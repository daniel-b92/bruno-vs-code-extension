import { basename, extname, resolve } from "path";

export function getTemporaryJsFileName(
    collectionRootDirectory: string,
    bruFileName: string
) {
    const oldBaseName = basename(bruFileName);
    return resolve(
        collectionRootDirectory,
        oldBaseName.replace(extname(oldBaseName), ".js")
    );
}
