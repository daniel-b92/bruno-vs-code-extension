import { lstatSync, readdirSync } from "fs";
import { dirname } from "path";
import { getTestFileDescendants } from "./getTestFileDescendants";
import { workspace } from "vscode";

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

export const isCollectionRootDir = async (path: string) => {
    const containsBrunoJsonFile =
        lstatSync(path).isDirectory() &&
        readdirSync(path).some((file) => file.endsWith("bruno.json"));
    const testfileDescendants = await getTestFileDescendants(path);
    return containsBrunoJsonFile && testfileDescendants.length > 0;
};

export const getCollectionRootDir = async (testFilePath: string) => {
    const allCollectionRootDirs = await getAllCollectionRootDirectories();
    const collectionRootDir = allCollectionRootDirs.find((rootDir) =>
        testFilePath.includes(rootDir)
    );
    if (!collectionRootDir) {
        throw new Error(
            `Could not find collection root directory for test item path '${testFilePath}'`
        );
    }
    return collectionRootDir;
};