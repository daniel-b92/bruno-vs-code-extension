import { commands, Hover, languages } from "vscode";
import {
    CollectionItemProvider,
    mapFromVsCodePosition,
    mapToVsCodeRange,
    OutputChannelLogger,
    parseBruFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../../shared";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { getCodeBlocks } from "../shared/codeBlocksUtils/getCodeBlocks";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { mapToRangeWithinBruFile } from "../shared/codeBlocksUtils/mapToRangeWithinBruFile";
import { waitForTempJsFileToBeInSyncWithBruFile } from "../shared/codeBlocksUtils/waitForTempJsFileToBeInSyncWithBruFile";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";

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
                mapToVsCodeRange(contentRange).contains(position),
            );

            if (!blockInBruFile) {
                return undefined;
            }

            if (token.isCancellationRequested) {
                logger?.debug(`Cancellation requested for hover provider.`);
                return undefined;
            }

            const temporaryJsDoc = await waitForTempJsFileToBeInSyncWithBruFile(
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
                logger?.debug(`Cancellation requested for hover provider.`);
                return undefined;
            }

            const resultFromJsFile = await commands.executeCommand<Hover[]>(
                "vscode.executeHoverProvider",
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
        },
    });
}
