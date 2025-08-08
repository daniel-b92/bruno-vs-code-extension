import { commands, Hover, languages } from "vscode";
import {
    CollectionItemProvider,
    mapRange,
    OutputChannelLogger,
    parseBruFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../shared";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { getCodeBlocks } from "../shared/codeBlocksUtils/getCodeBlocks";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { mapToRangeWithinBruFile } from "../shared/codeBlocksUtils/mapToRangeWithinBruFile";
import { waitForTempJsFileToBeInSync } from "../shared/codeBlocksUtils/waitForTempJsFileToBeInSync";
import { TempJsFileUpdateQueue } from "../shared/temporaryJsFilesUpdates/tempJsFileUpdateQueue";

export function provideInfosOnHover(
    queue: TempJsFileUpdateQueue,
    collectionItemProvider: CollectionItemProvider,
    logger?: OutputChannelLogger,
) {
    return languages.registerHoverProvider(getRequestFileDocumentSelector(), {
        async provideHover(document, position, token) {
            const collection =
                collectionItemProvider.getAncestorCollectionForPath(
                    document.fileName,
                );

            if (!collection) {
                return null;
            }

            const blocksToCheck = getCodeBlocks(
                parseBruFile(new TextDocumentHelper(document.getText())).blocks,
            );

            const blockInBruFile = blocksToCheck.find(({ contentRange }) =>
                mapRange(contentRange).contains(position),
            );

            if (blockInBruFile) {
                if (token.isCancellationRequested) {
                    logger?.debug(`Cancellation requested for hover provider.`);
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
                    logger?.debug(`Cancellation requested for hover provider.`);
                    return undefined;
                }

                const resultFromJsFile = await commands.executeCommand<Hover[]>(
                    "vscode.executeHoverProvider",
                    temporaryJsDoc.uri,
                    getPositionWithinTempJsFile(
                        temporaryJsDoc.getText(),
                        blockInBruFile.name as RequestFileBlockName,
                        position.translate(
                            -blockInBruFile.contentRange.start.line,
                        ),
                    ),
                );

                return resultFromJsFile.length == 0
                    ? null
                    : resultFromJsFile[0].range
                      ? new Hover(
                            resultFromJsFile[0].contents,
                            mapToRangeWithinBruFile(
                                blocksToCheck,
                                temporaryJsDoc.getText(),
                                resultFromJsFile[0].range,
                                logger,
                            ),
                        )
                      : resultFromJsFile[0];
            }
        },
    });
}
