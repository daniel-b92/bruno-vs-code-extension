import { dirname, resolve } from "path";
import {
    CollectionFormat,
    FeatureToggles,
    checkIfPathExistsAsync,
    convertToGlobPattern,
    getFileContent,
    getTestFileDescendants,
    normalizePath,
} from "../..";
import { promisify } from "util";
import { lstat } from "fs";
import { glob } from "glob";
import { getCollectionRootFileName } from "./collectionFormatFileNames";

export async function getAllCollectionRootDirectories(
    workspaceFolders: string[],
    featureToggles: FeatureToggles,
) {
    const bruRoots = await getBruCollectionRootDirectories(workspaceFolders);

    if (!featureToggles.yamlCollectionSupport) {
        return bruRoots;
    }

    const yamlRoots = await getYamlCollectionRootDirectories(workspaceFolders);

    return bruRoots.concat(
        yamlRoots.filter(
            ({ rootFolder }) =>
                // If a folder is a valid root for both formats, the bru format takes precedence.
                !bruRoots.some(
                    ({ rootFolder: bruRoot }) =>
                        normalizePath(bruRoot) == normalizePath(rootFolder),
                ),
        ),
    );
}

export function getCollectionRootFilePath(
    collectionRootFolder: string,
    format: CollectionFormat,
) {
    return resolve(collectionRootFolder, getCollectionRootFileName(format));
}

async function getBruCollectionRootDirectories(workspaceFolders: string[]) {
    const maybeFilesInCollectionRootDirs = await globFilesInWorkspaces(
        workspaceFolders,
        getCollectionRootFileName(CollectionFormat.Bru),
    );
    const result: {
        rootFolder: string;
        additionalContextRoots?: string[];
        format: CollectionFormat;
    }[] = [];

    for (const maybeCollectionRoot of maybeFilesInCollectionRootDirs.map(
        (path) => dirname(path),
    )) {
        const rootData = await getCollectionRootData(maybeCollectionRoot);

        if (rootData) {
            result.push({
                rootFolder: maybeCollectionRoot,
                format: CollectionFormat.Bru,
                ...rootData,
            });
        }
    }

    return result;
}

async function getYamlCollectionRootDirectories(workspaceFolders: string[]) {
    const result: {
        rootFolder: string;
        additionalContextRoots?: string[];
        format: CollectionFormat;
    }[] = [];

    for (const path of await globFilesInWorkspaces(
        workspaceFolders,
        getCollectionRootFileName(CollectionFormat.Yaml),
    )) {
        const isFile = await promisify(lstat)(path)
            .then((stats) => stats.isFile())
            .catch(() => false);

        if (isFile) {
            result.push({
                rootFolder: dirname(path),
                format: CollectionFormat.Yaml,
            });
        }
    }

    return result;
}

async function globFilesInWorkspaces(
    workspaceFolders: string[],
    fileName: string,
) {
    return (
        await Promise.all(
            workspaceFolders.map(
                async (workspace) =>
                    await glob(
                        `${convertToGlobPattern(workspace)}/**/${fileName}`,
                        { absolute: true },
                    ),
            ),
        )
    ).flat();
}

export function getBrunoJsonFilePath(collectionRootFolder: string) {
    return getCollectionRootFilePath(
        collectionRootFolder,
        CollectionFormat.Bru,
    );
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
    const fileContent = await getFileContent(brunoJsonFilePath);

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
