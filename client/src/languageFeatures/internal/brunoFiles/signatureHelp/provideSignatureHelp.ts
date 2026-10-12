import {
    commands,
    Disposable,
    languages,
    SignatureHelp,
    SignatureHelpProvider,
} from "vscode";
import { CollectionFormat, FeatureToggles } from "@global_shared";
import {
    mapFromVsCodePosition,
    OutputChannelLogger,
    TypedCollectionItemProvider,
} from "@shared";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { getCodeBlockContainingPosition } from "../shared/codeBlocksUtils/getCodeBlockContainingPosition";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { waitForTempJsFileToBeInSync } from "../../shared/temporaryJsFilesUpdates/external/waitForTempJsFileToBeInSync";

export function provideSignatureHelp(
    featureToggles: FeatureToggles,
    queue: TempJsFileUpdateQueue,
    collectionItemProvider: TypedCollectionItemProvider,
    logger?: OutputChannelLogger,
) {
    const provider = getProvider(queue, collectionItemProvider, logger);

    return Disposable.from(
        languages.registerSignatureHelpProvider(
            getRequestFileDocumentSelector(featureToggles, [
                CollectionFormat.Bru,
            ]),
            provider,
        ),
        // Bru files get their signature help from the TS server directly (see `typescriptServerPlugins` in the `package.json`),
        // but for Yaml files, this provider is the only source and therefore needs to be triggered automatically.
        languages.registerSignatureHelpProvider(
            getRequestFileDocumentSelector(featureToggles, [
                CollectionFormat.Yaml,
            ]),
            provider,
            // Same trigger characters as used by the Typescript language features of VS Code.
            { triggerCharacters: ["(", ",", "<"], retriggerCharacters: [")"] },
        ),
    );
}

function getProvider(
    queue: TempJsFileUpdateQueue,
    collectionItemProvider: TypedCollectionItemProvider,
    logger?: OutputChannelLogger,
): SignatureHelpProvider {
    return {
        async provideSignatureHelp(document, position, token) {
            const collection =
                collectionItemProvider.getAncestorCollectionForPath(
                    document.fileName,
                );
            const itemType = collection
                ?.getStoredDataForPath(document.fileName)
                ?.item.getItemType();

            if (!collection || !itemType) {
                return null;
            }

            const blockInSourceFile = getCodeBlockContainingPosition(
                document.getText(),
                position,
                itemType,
                collection.getFormat(),
            );

            if (!blockInSourceFile) {
                return undefined;
            }

            if (token.isCancellationRequested) {
                logger?.debug(
                    `Cancellation requested for signature help provider.`,
                );
                return undefined;
            }

            const temporaryJsDoc = await waitForTempJsFileToBeInSync(
                queue,
                {
                    collection,
                    sourceFileContentSnapshot: document.getText(),
                    sourceFilePath: document.fileName,
                    sourceFileEol: document.eol,
                    token,
                },
                logger,
            );

            if (!temporaryJsDoc) {
                return undefined;
            }

            if (token.isCancellationRequested) {
                logger?.debug(
                    `Cancellation requested for signature help provider.`,
                );
                return undefined;
            }

            return await commands.executeCommand<SignatureHelp>(
                "vscode.executeSignatureHelpProvider",
                temporaryJsDoc.uri,
                getPositionWithinTempJsFile(
                    temporaryJsDoc.getText(),
                    blockInSourceFile.name,
                    mapFromVsCodePosition(
                        position.translate(
                            -blockInSourceFile.contentRange.start.line,
                        ),
                    ),
                ),
            );
        },
    };
}
