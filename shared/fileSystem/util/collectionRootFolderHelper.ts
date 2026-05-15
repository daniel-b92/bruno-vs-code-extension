import { dirname, resolve } from "path";
import {
    checkIfPathExistsAsync,
    convertToGlobPattern,
    getTestFileDescendants,
} from "../..";
import { promisify } from "util";
import { lstat, readFile } from "fs";
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
        const rootData = await getCollectionRootData(maybeCollectionRoot);

        if (rootData) {
            result.push({
                rootFolder: maybeCollectionRoot,
                ...rootData,
            });
        }
    }

    return result;
}

export function getBrunoJsonFilePath(collectionRootFolder: string) {
    return resolve(collectionRootFolder, "bruno.json");
}

export async function getCollectionRootData(
    path: string,
): Promise<{ additionalContextRoots?: string[] } | undefined> {
    const isDirectory = await promisify(lstat)(path)
        .then((stats) => stats.isDirectory())
        .catch(() => undefined);

    const brunoJsonFilePath = isDirectory
        ? await getBrunoJsonFilePathIfExists(path)
        : undefined;

    if (!brunoJsonFilePath) {
        return undefined;
    }

    const testfileDescendants = await getTestFileDescendants(path);
    return testfileDescendants.length > 0
        ? {
              additionalContextRoots:
                  await getAdditionalContextRoots(brunoJsonFilePath),
          }
        : undefined;
}

async function getBrunoJsonFilePathIfExists(maybeCollectionRoot: string) {
    const brunoJsonFilePath = getBrunoJsonFilePath(maybeCollectionRoot);
    const isExistingFile =
        (await checkIfPathExistsAsync(brunoJsonFilePath)) &&
        ((
            await promisify(lstat)(brunoJsonFilePath).catch(() => undefined)
        )?.isFile() ??
            false);

    return isExistingFile ? brunoJsonFilePath : undefined;
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
