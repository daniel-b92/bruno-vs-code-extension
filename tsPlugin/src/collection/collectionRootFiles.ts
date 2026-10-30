import { basename } from "path";
import * as ts from "typescript/lib/tsserverlibrary";
import { CollectionFormat } from "../constants";

const bruCollectionRootFileName = "bruno.json";
const yamlCollectionRootFileName = "opencollection.yml";

export function isCollectionRootFileName(fileName: string) {
    const name = basename(fileName);

    return (
        name == bruCollectionRootFileName || name == yamlCollectionRootFileName
    );
}

/**
 * Returns the files within the given directory, that are named like a root file of a collection.
 * They only define a collection, if their content is valid (see `getFormatOfCollectionRootFile`).
 */
export function getCollectionRootFileCandidates(
    info: ts.server.PluginCreateInfo,
    directoryPath: string,
) {
    return info.serverHost
        .readDirectory(directoryPath, undefined, undefined, undefined, 1)
        .filter(isCollectionRootFileName);
}

export function getFormatOfCollectionRootFile(
    info: ts.server.PluginCreateInfo,
    fileName: string,
) {
    const content = info.languageServiceHost.readFile(fileName);

    if (!content) {
        return undefined;
    }

    if (basename(fileName) == bruCollectionRootFileName) {
        return isBrunoJsonForCollection(content)
            ? CollectionFormat.Bru
            : undefined;
    }

    return isOpenCollectionRootFileContent(content)
        ? CollectionFormat.Yaml
        : undefined;
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
