import * as ts from "typescript/lib/tsserverlibrary";
import { hasEmbeddedCodeBlocks, isJsFile } from "../fileTypes";
import { PluginConfiguration } from "../pluginConfiguration";
import { getRootFolderOfContainingCollection } from "./collectionFormat";

/**
 * Returns the folder that the objects, which Bruno provides at runtime (e.g. `bru`), are declared in for the given file (see `provideRuntimeDefinitions`).
 *
 * These objects are available for the code blocks of the files in a collection and for all Javascript files within a collection.
 * Javascript files within the additional context roots of a collection can use them as well.
 */
export function getRuntimeDefinitionsFolder(
    info: ts.server.PluginCreateInfo,
    configuration: PluginConfiguration,
    fileName: string,
) {
    if (!hasEmbeddedCodeBlocks(fileName) && !isJsFile(fileName)) {
        return undefined;
    }

    return (
        getRootFolderOfContainingCollection(info, fileName) ??
        (isJsFile(fileName)
            ? configuration.getAdditionalContextRootContaining(fileName)
            : undefined)
    );
}

/**
 * Whether the results for the given file can refer to the virtual file with the runtime definitions.
 * That is the case for every file within a collection, since the virtual file is part of the whole project.
 */
export function canReferToRuntimeDefinitions(
    info: ts.server.PluginCreateInfo,
    configuration: PluginConfiguration,
    fileName: string,
) {
    return (
        getRootFolderOfContainingCollection(info, fileName) != undefined ||
        (isJsFile(fileName) &&
            configuration.getAdditionalContextRootContaining(fileName) !=
                undefined)
    );
}
