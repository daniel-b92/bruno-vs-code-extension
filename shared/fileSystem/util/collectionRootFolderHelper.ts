import { dirname, isAbsolute, relative, resolve } from "path";
import {
    CollectionFormat,
    FeatureToggles,
    checkIfPathExistsAsync,
    convertToGlobPattern,
    getFileContent,
    getTestFileDescendants,
    isInFolderForEnvironmentFiles,
    normalizePath,
    parseCollectionSettingsFile,
    TextDocumentHelper,
} from "../..";
import { promisify } from "util";
import { lstat } from "fs";
import { glob } from "glob";
import { getCollectionRootFileName } from "./collectionFormatFileNames";

export type CollectionRootDirectory = {
    rootFolder: string;
    additionalContextRoots?: string[];
    format: CollectionFormat;
};

export type ConflictingCollectionRootFiles = {
    rootFilePath: string;
    conflictingFilePaths: string[];
};

export async function getAllCollectionRootDirectories(
    workspaceFolders: string[],
    featureToggles: FeatureToggles,
): Promise<{
    roots: CollectionRootDirectory[];
    conflicts: ConflictingCollectionRootFiles[];
}> {
    if (!featureToggles.yamlCollectionSupport) {
        return {
            roots: await getBruCollectionRootDirectories(
                await globFilesInWorkspaces(
                    workspaceFolders,
                    getCollectionRootFileName(CollectionFormat.Bru),
                ),
            ),
            conflicts: [],
        };
    }

    const bruRootFiles = await globFilesInWorkspaces(
        workspaceFolders,
        getCollectionRootFileName(CollectionFormat.Bru),
    );
    // An environment named like the root file (`environments/opencollection.yml`) is no collection root.
    const yamlRootFiles = (
        await globFilesInWorkspaces(
            workspaceFolders,
            getCollectionRootFileName(CollectionFormat.Yaml),
        )
    ).filter((path) => !isInFolderForEnvironmentFiles(path));
    const { conflicts, nonConflicting } = splitByConflicts(
        bruRootFiles.concat(yamlRootFiles),
    );
    const isNonConflicting = (path: string) =>
        nonConflicting.some((other) => isSamePath(other, path));

    return {
        roots: (
            await getBruCollectionRootDirectories(
                bruRootFiles.filter(isNonConflicting),
            )
        ).concat(
            await getYamlCollectionRootDirectories(
                yamlRootFiles.filter(isNonConflicting),
            ),
        ),
        conflicts,
    };
}

export function getCollectionRootFilePath(
    collectionRootFolder: string,
    format: CollectionFormat,
) {
    return resolve(collectionRootFolder, getCollectionRootFileName(format));
}

async function getBruCollectionRootDirectories(rootFilePaths: string[]) {
    return await getRootDirectoriesForFiles(
        rootFilePaths,
        CollectionFormat.Bru,
    );
}

async function getYamlCollectionRootDirectories(rootFilePaths: string[]) {
    return await getRootDirectoriesForFiles(
        rootFilePaths,
        CollectionFormat.Yaml,
    );
}

async function getRootDirectoriesForFiles(
    rootFilePaths: string[],
    format: CollectionFormat,
) {
    const result: CollectionRootDirectory[] = [];

    for (const rootFolder of rootFilePaths.map((path) => dirname(path))) {
        const rootData = await getCollectionRootData(rootFolder, format);

        if (rootData) {
            result.push({ rootFolder, format, ...rootData });
        }
    }

    return result;
}

/**
 * A collection root file only counts, if no other collection root file (of any format)
 * exists in the same directory or in any of its subdirectories.
 */
function splitByConflicts(rootFilePaths: string[]) {
    const uniquePaths = rootFilePaths.filter(
        (path, index) =>
            rootFilePaths.findIndex((other) => isSamePath(other, path)) ==
            index,
    );
    const conflicts: ConflictingCollectionRootFiles[] = [];
    const nonConflicting: string[] = [];

    for (const rootFilePath of uniquePaths) {
        const conflictingFilePaths = uniquePaths.filter(
            (other) =>
                !isSamePath(other, rootFilePath) &&
                isInDirectoryOrSubdirectory(
                    dirname(other),
                    dirname(rootFilePath),
                ),
        );

        if (conflictingFilePaths.length > 0) {
            conflicts.push({ rootFilePath, conflictingFilePaths });
        } else {
            nonConflicting.push(rootFilePath);
        }
    }

    return { conflicts, nonConflicting };
}

function isSamePath(a: string, b: string) {
    return normalizePath(a) == normalizePath(b);
}

function isInDirectoryOrSubdirectory(path: string, directory: string) {
    const relativePath = relative(
        normalizePath(directory),
        normalizePath(path),
    );

    return !relativePath.startsWith("..") && !isAbsolute(relativePath);
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
    format: CollectionFormat,
): Promise<{ additionalContextRoots?: string[] } | undefined> {
    const isDirectory = await promisify(lstat)(path)
        .then((stats) => stats.isDirectory())
        .catch(() => undefined);

    const rootFilePath = isDirectory
        ? await getRootFilePathIfExists(path, format)
        : undefined;

    if (!rootFilePath) {
        return undefined;
    }

    // A stray `bruno.json` (e.g. left over from a migration to Yaml) must not be treated as a Bru collection.
    if (
        format == CollectionFormat.Bru &&
        (await getTestFileDescendants(path)).length == 0
    ) {
        return undefined;
    }

    return {
        additionalContextRoots:
            format == CollectionFormat.Yaml
                ? await getAdditionalContextRootsFromYaml(rootFilePath)
                : await getAdditionalContextRootsFromBrunoJson(rootFilePath),
    };
}

async function getRootFilePathIfExists(
    maybeCollectionRoot: string,
    format: CollectionFormat,
) {
    const rootFilePath = getCollectionRootFilePath(maybeCollectionRoot, format);
    const isExistingFile =
        (await checkIfPathExistsAsync(rootFilePath)) &&
        ((
            await promisify(lstat)(rootFilePath).catch(() => undefined)
        )?.isFile() ??
            false);

    return isExistingFile ? rootFilePath : undefined;
}

async function getAdditionalContextRootsFromYaml(rootFilePath: string) {
    const fileContent = await getFileContent(rootFilePath);

    if (fileContent === undefined) {
        return undefined;
    }

    const roots = parseCollectionSettingsFile(
        new TextDocumentHelper(fileContent),
    ).result?.properties.extensions?.properties.bruno?.properties.scripts
        ?.properties.additionalContextRoots?.value;

    return roots?.map(({ value }) => resolve(dirname(rootFilePath), value));
}

async function getAdditionalContextRootsFromBrunoJson(
    brunoJsonFilePath: string,
) {
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
