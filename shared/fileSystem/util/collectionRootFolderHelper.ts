import { basename, dirname, resolve } from "path";
import { convertToGlobPattern, getTestFileDescendants } from "../..";
import { promisify } from "util";
import { lstat, readdir, readFile } from "fs";
import { glob } from "glob";

export async function getAllCollectionRootDirectories(
    workspaceFolders: string[],
) {
    const maybeFilesInCollectionRootDirs = (
        await Promise.all(
            workspaceFolders.map(
                async (workspace) =>
                    await glob(
                        `${convertToGlobPattern(workspace)}/**/bruno.json`,
                        { absolute: true },
                    ),
            ),
        )
    ).flat();
    const result: { rootFolder: string; additionalContextRoots?: string[] }[] =
        [];

    for (const maybeCollectionRoot of maybeFilesInCollectionRootDirs.map(
        (path) => dirname(path),
    )) {
        const additionalContextRoots =
            await getCollectionRootData(maybeCollectionRoot);

        if (additionalContextRoots) {
            result.push({
                rootFolder: maybeCollectionRoot,
                additionalContextRoots,
            });
        }
    }

    return result;
}

async function getCollectionRootData(path: string) {
    const isDirectory = await promisify(lstat)(path)
        .then((stats) => stats.isDirectory())
        .catch(() => undefined);

    const brunoJsonFilePath = isDirectory
        ? await getBrunoJsonFilePath(path)
        : undefined;

    if (!brunoJsonFilePath) {
        return undefined;
    }

    const testfileDescendants = await getTestFileDescendants(path);
    return testfileDescendants.length > 0
        ? await getAdditionalContextRoots(brunoJsonFilePath)
        : undefined;
}

async function getBrunoJsonFilePath(maybeCollectionRoot: string) {
    const allItems = await promisify(readdir)(maybeCollectionRoot, {
        withFileTypes: true,
    }).catch(() => undefined);

    const matchingFile = allItems?.find(
        (item) => item.isFile() && basename(item.name) == "bruno.json",
    );

    return matchingFile
        ? resolve(matchingFile.parentPath, matchingFile.name)
        : undefined;
}

async function getAdditionalContextRoots(brunoJsonFilePath: string) {
    const fileContent = await promisify(readFile)(brunoJsonFilePath, {
        encoding: "utf-8",
    }).catch(() => undefined);

    if (fileContent === undefined) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(fileContent) as unknown;

        if (
            typeof parsed == "object" &&
            parsed != null &&
            "scripts" in parsed &&
            typeof parsed.scripts == "object" &&
            parsed.scripts != null &&
            "additionalContextRoots" in parsed.scripts
        ) {
            const { additionalContextRoots } = parsed.scripts;
            return Array.isArray(additionalContextRoots) &&
                additionalContextRoots.every((item) => typeof item == "string")
                ? additionalContextRoots.map((root) =>
                      resolve(dirname(brunoJsonFilePath), root),
                  )
                : undefined;
        }
    } catch {
        return undefined;
    }
}
