import { dirname, resolve } from "path";
import {
    CollectionFormat,
    FeatureToggles,
    checkIfPathExistsAsync,
    convertToGlobPattern,
    getFileContent,
    normalizePath,
    parseCollectionSettingsFile,
    TextDocumentHelper,
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
        const rootData = await getCollectionRootData(
            maybeCollectionRoot,
            CollectionFormat.Bru,
        );

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
        const rootFolder = dirname(path);
        const rootData = await getCollectionRootData(
            rootFolder,
            CollectionFormat.Yaml,
        );

        if (rootData) {
            result.push({
                rootFolder,
                format: CollectionFormat.Yaml,
                ...rootData,
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
