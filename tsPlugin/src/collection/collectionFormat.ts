import { dirname, extname } from "path";
import * as ts from "typescript/lib/tsserverlibrary";
import { CollectionFormat } from "../constants";

/**
 * Collection files in the Yaml format always use the extension `.yml`.
 */
export function isFileFromYamlCollection(
    info: ts.server.PluginCreateInfo,
    fileName: string,
) {
    return (
        extname(fileName) == ".yml" &&
        getFormatOfContainingCollection(info, fileName) == CollectionFormat.Yaml
    );
}

function getFormatOfContainingCollection(
    info: ts.server.PluginCreateInfo,
    fileName: string,
) {
    return getContainingCollection(info, fileName)?.format;
}

export function getRootFolderOfContainingCollection(
    info: ts.server.PluginCreateInfo,
    fileName: string,
) {
    return getContainingCollection(info, fileName)?.rootFolder;
}

function getContainingCollection(
    info: ts.server.PluginCreateInfo,
    fileName: string,
) {
    let currentDirectory = dirname(fileName);
    let format = getFormatIfCollectionRootFolder(info, currentDirectory);

    while (
        info.serverHost.directoryExists(currentDirectory) &&
        !format &&
        dirname(currentDirectory) != currentDirectory // dirname of a base folder in the file system seems to return the input folder again
    ) {
        currentDirectory = dirname(currentDirectory);
        format = getFormatIfCollectionRootFolder(info, currentDirectory);
    }

    return format ? { format, rootFolder: currentDirectory } : undefined;
}

function getFormatIfCollectionRootFolder(
    info: ts.server.PluginCreateInfo,
    directoryPath: string,
) {
    const collectionRootFile = info.serverHost
        .readDirectory(directoryPath, undefined, undefined, undefined, 1)
        .find((fileName) => {
            const isBruCollectionRootFile = fileName.endsWith("bruno.json");
            const isYamlCollectionRootFile =
                fileName.endsWith("opencollection.yml");

            if (!isBruCollectionRootFile && !isYamlCollectionRootFile) {
                return false;
            }

            const content = info.languageServiceHost.readFile(fileName);

            if (!content) {
                return false;
            }

            return isBruCollectionRootFile
                ? isBrunoJsonForCollection(content)
                : isOpenCollectionRootFileContent(content);
        });

    if (!collectionRootFile) {
        return undefined;
    }

    return collectionRootFile.endsWith("bruno.json")
        ? CollectionFormat.Bru
        : CollectionFormat.Yaml;
}

function isBrunoJsonForCollection(content: string) {
    try {
        const parsedContent = JSON.parse(content) as
            { type: string } | undefined;

        return parsedContent && parsedContent.type == "collection";
    } catch {
        return false;
    }
}

/**
 * Request, folder and environment files can be named `opencollection.yml` as well.
 * Only the actual collection root file defines the top-level key `opencollection`.
 */
function isOpenCollectionRootFileContent(content: string) {
    return /^opencollection\s*:/m.test(content);
}
