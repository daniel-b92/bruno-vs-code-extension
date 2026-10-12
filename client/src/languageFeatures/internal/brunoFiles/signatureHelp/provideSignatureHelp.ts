import { commands, DocumentSelector, languages, SignatureHelp } from "vscode";
import {
    mapFromVsCodePosition,
    OutputChannelLogger,
    TypedCollectionItemProvider,
} from "@shared";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { getCodeBlockContainingPosition } from "../shared/codeBlocksUtils/getCodeBlockContainingPosition";
import { waitForTempJsFileToBeInSync } from "../../shared/temporaryJsFilesUpdates/external/waitForTempJsFileToBeInSync";

export function provideSignatureHelp(
    documentSelector: DocumentSelector,
    queue: TempJsFileUpdateQueue,
    collectionItemProvider: TypedCollectionItemProvider,
    logger?: OutputChannelLogger,
) {
    return languages.registerSignatureHelpProvider(documentSelector, {
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
    });
}
