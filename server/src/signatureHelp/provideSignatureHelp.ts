import { commands, languages, SignatureHelp } from "vscode";
import {
    CollectionItemProvider,
    mapRange,
    OutputChannelLogger,
    parseBruFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../client/sharedd
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { getCodeBlocks } from "../shared/codeBlocksUtils/getCodeBlocks";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { waitForTempJsFileToBeInSync } from "../shared/codeBlocksUtils/waitForTempJsFileToBeInSync";
import { TempJsFileUpdateQueue } from "../shared/temporaryJsFilesUpdates/tempJsFileUpdateQueue";

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

                const blocksToCheck = getCodeBlocks(
                    parseBruFile(new TextDocumentHelper(document.getText()))
                        .blocks,
                );

                const blockInBruFile = blocksToCheck.find(({ contentRange }) =>
                    mapRange(contentRange).contains(position),
                );

                if (blockInBruFile) {
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
                            bruFileCodeBlocksSnapshot: blocksToCheck,
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
                            position.translate(
                                -blockInBruFile.contentRange.start.line,
                            ),
                        ),
                    );
                }
            },
        },
    );
}
