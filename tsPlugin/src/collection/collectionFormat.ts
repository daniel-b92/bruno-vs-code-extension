import { extname } from "path";
import * as ts from "typescript/lib/tsserverlibrary";
import { CollectionFormat } from "../constants";
import { getCollectionLookup } from "./collectionLookup";

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
    return getCollectionLookup(info).getContainingCollection(fileName);
}
