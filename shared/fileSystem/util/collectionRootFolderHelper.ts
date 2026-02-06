import { basename, dirname } from "path";
import { getTestFileDescendants } from "../..";
import { promisify } from "util";
import { lstat, readdir } from "fs";
import { glob } from "glob";

export async function getAllCollectionRootDirectories(
    workspaceFolders: string[],
) {
    const maybeFilesInCollectionRootDirs = (
        await Promise.all(
            workspaceFolders.map(
                async (workspace) => await glob(`${workspace}/**/bruno.json`),
            ),
        )
    ).flat();
    const result: string[] = [];

    for (const maybeCollectionRoot of maybeFilesInCollectionRootDirs.map(
        (path) => dirname(path),
    )) {
        const isCollectionRoot = await isCollectionRootDir(maybeCollectionRoot);
        if (isCollectionRoot) {
            result.push(maybeCollectionRoot);
        }
    }

    return result;
}

async function isCollectionRootDir(path: string) {
    const isDirectory = await promisify(lstat)(path)
        .then((stats) => stats.isDirectory())
        .catch(() => undefined);

    if (isDirectory === undefined) {
        return false;
    }
    const containsBrunoJsonFile =
        isDirectory &&
        (await promisify(readdir)(path)
            .then((itemNames) =>
                itemNames.some((file) => basename(file) == "bruno.json"),
            )
            .catch(() => false));

    if (!containsBrunoJsonFile) {
        return false;
    }

    const testfileDescendants = await getTestFileDescendants(path);
    return testfileDescendants.length > 0;
}
