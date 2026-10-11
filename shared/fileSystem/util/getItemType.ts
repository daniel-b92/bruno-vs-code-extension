import { dirname, extname } from "path";
import {
    checkIfPathExistsAsync,
    normalizePath,
    doesFileNameMatchFolderSettingsFileName,
    isInFolderForEnvironmentFiles,
    BrunoFileType,
    ItemType,
    NonBrunoSpecificItemType,
    doesFileNameMatchCollectionSettingsFile,
    ReadyOnlyCollection,
    parseBlockFromFile,
    TextDocumentHelper,
    RequestFileBlockName,
    isDictionaryBlockSimpleField,
    MetaBlockKey,
    CollectionFormat,
    FileInfoType,
    getInfoTypeFromYamlContent,
    hasInfoBlockInYamlContent,
    getFileExtensionForFormat,
} from "../..";
import {
    getFileSystemDataPath,
    getFileSystemDataStats,
} from "../../fileSystemCache/internal/fileSystemDataUtils";
import { FileSystemData } from "../../fileSystemCache/internal/interfaces";
import { readFile } from "fs/promises";

export async function getItemType<T>(
    collection: ReadyOnlyCollection<T>,
    fileSystemData: FileSystemData,
    validateExistence = true,
): Promise<ItemType | undefined> {
    const path = getFileSystemDataPath(fileSystemData);

    if (validateExistence && !(await checkIfPathExistsAsync(path))) {
        return undefined;
    }

    const format = collection.getFormat();
    const isValidBruFile =
        extname(path) == getFileExtensionForFormat(format) &&
        normalizePath(path).startsWith(
            normalizePath(collection.getRootDirectory()),
        );

    if (!isValidBruFile) {
        const stats = await getFileSystemDataStats(fileSystemData);

        return stats === undefined
            ? undefined
            : stats.isFile()
              ? NonBrunoSpecificItemType.OtherFileType
              : stats.isDirectory()
                ? // Some files from external packages are neither seen as files nor directories.
                  NonBrunoSpecificItemType.Directory
                : undefined;
    }

    if (isInFolderForEnvironmentFiles(path)) {
        return BrunoFileType.EnvironmentFile;
    } else if (
        isChildElementOfCollectionRootDirectory(collection, path) &&
        doesFileNameMatchCollectionSettingsFile(path, format)
    ) {
        return BrunoFileType.CollectionSettingsFile;
    } else if (
        !isChildElementOfCollectionRootDirectory(collection, path) &&
        doesFileNameMatchFolderSettingsFileName(path, format)
    ) {
        return BrunoFileType.FolderSettingsFile;
    } else if (format == CollectionFormat.Yaml) {
        return await getItemTypeForOtherYamlFile(path);
    } else {
        const content = await readFile(path, { encoding: "utf-8" }).catch(
            () => undefined,
        );

        const metaBlock = content
            ? parseBlockFromFile(
                  new TextDocumentHelper(content),
                  RequestFileBlockName.Meta,
              )
            : undefined;

        if (!content || !metaBlock) {
            return NonBrunoSpecificItemType.OtherFileType;
        }
        return Array.isArray(metaBlock.content) &&
            metaBlock.content.every(isDictionaryBlockSimpleField) &&
            metaBlock.content.find(({ key }) => key == MetaBlockKey.Type)
                ?.value == "app"
            ? BrunoFileType.AppFile
            : BrunoFileType.RequestFile;
    }
}

async function getItemTypeForOtherYamlFile(path: string) {
    const content = await readFile(path, { encoding: "utf-8" }).catch(
        () => undefined,
    );
    if (!content || !hasInfoBlockInYamlContent(content)) {
        return NonBrunoSpecificItemType.OtherFileType;
    }

    // Like for Bru files, any file with an info block that is not an app file is treated as a request file.
    return getInfoTypeFromYamlContent(content) == FileInfoType.App
        ? BrunoFileType.AppFile
        : BrunoFileType.RequestFile;
}

function isChildElementOfCollectionRootDirectory<T>(
    collection: ReadyOnlyCollection<T>,
    path: string,
) {
    return collection.isRootDirectory(dirname(path));
}
