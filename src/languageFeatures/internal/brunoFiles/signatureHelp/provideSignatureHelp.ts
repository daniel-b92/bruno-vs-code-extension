import { commands, languages, SignatureHelp } from "vscode";
import {
    CollectionItemProvider,
    mapFromVsCodePosition,
    OutputChannelLogger,
    RequestFileBlockName,
} from "../../../../shared";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { getCodeBlockContainingPosition } from "../shared/codeBlocksUtils/getCodeBlockContainingPosition";
import { waitForTempJsFileToBeInSync } from "../../shared/temporaryJsFilesUpdates/external/waitForTempJsFileToBeInSync";

export function provideSignatureHelp(
    queue: TempJsFileUpdateQueue,
    collectionItemProvider: CollectionItemProvider,
    logger?: OutputChannelLogger,
) {
    return languages.registerSignatureHelpProvider(
        getRequestFileDocumentSelector(),
        {
            async provideSignatureHelp(document, position, token) {
                const collection =
                    collectionItemProvider.getAncestorCollectionForPath(
                        document.fileName,
                    );

                if (!collection) {
                    return null;
                }

                const blockInBruFile = getCodeBlockContainingPosition(
                    document.getText(),
                    position,
                );

                if (!blockInBruFile) {
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
                        bruFileContentSnapshot: document.getText(),
                        bruFilePath: document.fileName,
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
                        blockInBruFile.name as RequestFileBlockName,
                        mapFromVsCodePosition(
                            position.translate(
                                -blockInBruFile.contentRange.start.line,
                            ),
                        ),
                    ),
                );
            },
        },
    );
}
