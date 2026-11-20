import { ExtensionContext, TabInputText, window } from "vscode";
import {
    getLoggerFromSubscriptions,
    TypedCollectionItemProvider,
} from "@shared";
import { getFileExtensionForFormat, CollectionFormat } from "@global_shared";
import { extname } from "path";
import { configureTsServerPlugin } from "./configureTsServerPlugin";
import { deleteLegacyTempJsFiles } from "./deleteLegacyTempJsFiles";
import { registerLineCommentCommands } from "./internal/brunoFiles/lineComments/registerLineCommentCommands";

/**
 * The intellisense for code blocks and Javascript files is provided by the Typescript server plugin (see `configureTsServerPlugin`).
 */
export async function activateLanguageFeatures(
    context: ExtensionContext,
    collectionItemProvider: TypedCollectionItemProvider,
) {
    const logger = getLoggerFromSubscriptions(context);

    await configureTsServerPlugin(context, collectionItemProvider, logger);

    // TODO: Remove this special treatment of leftover temporary js files at some point in the future, once versions of the extension that created them are no longer in use.
    // The collection cache is loaded lazily, so the folders to clean up are only known after it has been loaded.
    collectionItemProvider.subscribeToInitialCacheLoad(() =>
        deleteLegacyTempJsFiles(collectionItemProvider, logger),
    );

    context.subscriptions.push(
        window.onDidChangeActiveTextEditor(async (editor) => {
            if (!editor) {
                return;
            }

            const { fileName } = editor.document;

            // The collection cache is loaded lazily, so it can only be used after it has been loaded.
            if (collectionItemProvider.isFileRelevantForCollections(fileName)) {
                await collectionItemProvider.ensureCacheIsLoaded();
            }

            warnIfBruFileIsNotPartOfCollection(
                collectionItemProvider,
                editor.document.uri.toString(),
                fileName,
            );
        }),
        ...registerLineCommentCommands(collectionItemProvider),
    );
}

function warnIfBruFileIsNotPartOfCollection(
    itemProvider: TypedCollectionItemProvider,
    documentUri: string,
    filePath: string,
) {
    const activeTabInput = window.tabGroups.activeTabGroup.activeTab?.input;

    if (
        !(activeTabInput instanceof TabInputText) ||
        documentUri != activeTabInput.uri.toString() ||
        extname(filePath) != getFileExtensionForFormat(CollectionFormat.Bru)
    ) {
        return;
    }

    const collection = itemProvider.getAncestorCollectionForPath(filePath);

    if (
        !collection ||
        extname(filePath) != getFileExtensionForFormat(collection.getFormat())
    ) {
        window.showWarningMessage(
            "'bru' file seems to not be part of a valid collection. Therefore, intellisense will be limited.",
        );
    }
}
