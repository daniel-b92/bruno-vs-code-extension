import * as ts from "typescript/lib/tsserverlibrary";
import { getCollectionLookup } from "../collection/collectionLookup";
import { getRuntimeDefinitionsFolder } from "../collection/runtimeContext";
import {
    getRuntimeDefinitionsFileName,
    isRuntimeDefinitionsFile,
    isTempJsFile,
} from "../constants";
import { PluginConfiguration } from "../pluginConfiguration";
import { getRuntimeDefinitionsFileContent } from "../runtimeDefinitions/getRuntimeDefinitionsFileContent";

/**
 * Bruno provides some objects at runtime that are available in every script of a collection (e.g. `bru`, `req` and `res`).
 * The Typescript server needs to know them for the code blocks in `.bru` and Yaml files and for Javascript files within collections.
 *
 * Therefore, a virtual file with the definitions is added to the project for every collection with such files.
 * It is located within the root folder of the collection, so that `chai` and `mocha` are resolved from the `node_modules` of the collection.
 * The same applies to Javascript files within the additional context roots of a collection (see `PluginConfig`), which get the file within the context root folder.
 * The file does not exist on the disk, so results that point to it (e.g. definitions) have to be filtered out.
 */
export function provideRuntimeDefinitions(
    info: ts.server.PluginCreateInfo,
    configuration: PluginConfiguration,
) {
    const host = info.languageServiceHost;

    const getOriginalScriptFileNames = host.getScriptFileNames.bind(host);
    const getOriginalScriptVersion = host.getScriptVersion.bind(host);
    const getOriginalSnapshot = host.getScriptSnapshot.bind(host);
    const fileExistsOriginally = host.fileExists.bind(host);
    const readOriginally = host.readFile.bind(host);

    let snapshot: ts.IScriptSnapshot | undefined;

    // Determining the collection for a file requires reading from the file system, but the root file names are requested very often.
    // So the collections are cached. They are determined again, when the root files change.
    const collectionLookup = getCollectionLookup(info);
    let cachedFileNames: string[] = [];

    host.getScriptFileNames = () => {
        // Temporary files from older versions of the extension would declare the runtime objects a second time.
        const originalFileNames = getOriginalScriptFileNames().filter(
            (fileName) => !isTempJsFile(fileName),
        );

        if (!haveSameElements(originalFileNames, cachedFileNames)) {
            cachedFileNames = originalFileNames.slice();
            collectionLookup.clear();
        }

        const runtimeDefinitionsFiles = new Set(
            originalFileNames.flatMap((fileName) => {
                const folder = getRuntimeDefinitionsFolder(
                    info,
                    configuration,
                    fileName,
                );

                return folder
                    ? [`${folder}/${getRuntimeDefinitionsFileName()}`]
                    : [];
            }),
        );

        runtimeDefinitionsFiles.forEach(registerFile);

        return originalFileNames.concat(
            [...runtimeDefinitionsFiles].filter(
                (fileName) => !originalFileNames.includes(fileName),
            ),
        );
    };

    // The Typescript server requires every file in a program to be known by the project service (and attached to the project, otherwise it is removed again).
    // The project is not set when the plugin is used without a Typescript server (e.g. in tests).
    const registerFile = (fileName: string) =>
        info.project?.projectService
            .getOrCreateScriptInfoForNormalizedPath(
                ts.server.toNormalizedPath(fileName),
                false,
                undefined,
                ts.ScriptKind.JS,
                false,
                // The file would not be found on the disk.
                { fileExists: () => true },
            )
            ?.attachToProject(info.project);

    host.getScriptVersion = (fileName) =>
        isRuntimeDefinitionsFile(fileName)
            ? "1"
            : getOriginalScriptVersion(fileName);

    host.getScriptSnapshot = (fileName) => {
        if (!isRuntimeDefinitionsFile(fileName)) {
            return getOriginalSnapshot(fileName);
        }

        snapshot ??= ts.ScriptSnapshot.fromString(
            getRuntimeDefinitionsFileContent(),
        );

        return snapshot;
    };

    host.fileExists = (fileName) =>
        isRuntimeDefinitionsFile(fileName) || fileExistsOriginally(fileName);

    host.readFile = (fileName, encoding) =>
        isRuntimeDefinitionsFile(fileName)
            ? getRuntimeDefinitionsFileContent()
            : readOriginally(fileName, encoding);
}

function haveSameElements(first: string[], second: string[]) {
    return (
        first.length == second.length &&
        first.every((element, index) => element == second[index])
    );
}
