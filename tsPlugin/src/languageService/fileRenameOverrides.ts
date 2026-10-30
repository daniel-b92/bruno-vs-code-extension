import { posix } from "path";
import * as ts from "typescript/lib/tsserverlibrary";
import { createCheckForChangesWithinCodeBlocks } from "../codeChanges/codeChanges";
import { getRootFolderOfContainingCollection } from "../collection/collectionFormat";
import { hasEmbeddedCodeBlocks } from "../fileTypes";
import {
    isPathWithinFolder,
    usesCaseSensitiveFileNames,
} from "../pathComparison";

// Bruno resolves modules imported within `.bru` and Yaml files relative to the collection root (see `treatCollectionFilesLikeJavascript`),
// but the Typescript server computes the updated module paths relative to the folder of the importing file.
export function overrideFileRenames(
    info: ts.server.PluginCreateInfo,
    proxy: ts.LanguageService,
) {
    proxy.getEditsForFileRename = (
        oldFilePath,
        newFilePath,
        formatOptions,
        preferences,
    ) => {
        const areAllChangesWithinCodeBlocks =
            createCheckForChangesWithinCodeBlocks(info);

        return info.languageService
            .getEditsForFileRename(
                oldFilePath,
                newFilePath,
                formatOptions,
                preferences,
            )
            .flatMap((fileChanges) => {
                const { fileName, textChanges } = fileChanges;

                if (!hasEmbeddedCodeBlocks(fileName)) {
                    return [fileChanges];
                }

                const collectionRoot = getRootFolderOfContainingCollection(
                    info,
                    fileName,
                );

                // Moving the importing file itself does not change the folder that its imports are resolved from.
                if (
                    !collectionRoot ||
                    isPathWithinFolder(
                        fileName,
                        oldFilePath,
                        usesCaseSensitiveFileNames(info),
                    )
                ) {
                    return [];
                }

                const adjustedChanges = {
                    ...fileChanges,
                    textChanges: textChanges.map((textChange) => ({
                        ...textChange,
                        newText: getModulePathRelativeToCollectionRoot(
                            textChange.newText,
                            posix.dirname(fileName),
                            collectionRoot,
                        ),
                    })),
                };

                return areAllChangesWithinCodeBlocks([adjustedChanges])
                    ? [adjustedChanges]
                    : [];
            });
    };
}

/**
 * The module path is relative to the given folder, if it starts with `./` or `../`. Other module paths (e.g. for packages) stay the same.
 */
function getModulePathRelativeToCollectionRoot(
    modulePath: string,
    folder: string,
    collectionRoot: string,
) {
    if (!/^\.\.?(\/|$)/.test(modulePath)) {
        return modulePath;
    }

    const relativePath = posix.relative(
        collectionRoot,
        posix.join(folder, modulePath),
    );

    return relativePath.startsWith("../") || relativePath == ".."
        ? relativePath
        : `./${relativePath}`;
}
