import { dirname } from "path";
import { getTestFileDescendants } from "./getTestFileDescendants";
import { workspace } from "vscode";
import { promisify } from "util";
import { lstat, readdir } from "fs";

export const getAllCollectionRootDirectories = async () => {
    const maybeFilesInCollectionRootDirs = await workspace.findFiles(
        "**/bruno.json"
    );
    const result: string[] = [];

    for (const maybeCollectionRoot of maybeFilesInCollectionRootDirs.map(
        (uri) => dirname(uri.fsPath)
    )) {
        const isCollectionRoot = await isCollectionRootDir(maybeCollectionRoot);
        if (isCollectionRoot) {
            result.push(maybeCollectionRoot);
        }
    }

    return result;
};

const isCollectionRootDir = async (path: string) => {
    const containsBrunoJsonFile =
        (await promisify(lstat)(path)).isDirectory() &&
        (await promisify(readdir)(path)).some((file) =>
            file.endsWith("bruno.json")
        );

    if (!containsBrunoJsonFile) {
        return false;
    }

    const testfileDescendants = await getTestFileDescendants(path);
    return testfileDescendants.length > 0;
};
