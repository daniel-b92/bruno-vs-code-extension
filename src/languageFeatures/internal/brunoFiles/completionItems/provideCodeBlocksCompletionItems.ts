import {
    languages,
    commands,
    CompletionList,
    CompletionItem,
    TextEdit,
    Range as VsCodeRange,
} from "vscode";
import {
    CollectionItemProvider,
    parseBruFile,
    TextDocumentHelper,
    mapToVsCodeRange,
    RequestFileBlockName,
    OutputChannelLogger,
    mapFromVsCodePosition,
} from "../../../../shared";
import { getCodeBlocks } from "../../shared/codeBlocksUtils/getCodeBlocks";
import { getPositionWithinTempJsFile } from "../../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { mapToRangeWithinBruFile } from "../../shared/codeBlocksUtils/mapToRangeWithinBruFile";
import { getRequestFileDocumentSelector } from "../../shared/getRequestFileDocumentSelector";
import { waitForTempJsFileToBeInSyncWithBruFile } from "../../shared/codeBlocksUtils/waitForTempJsFileToBeInSyncWithBruFile";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";

export function provideCodeBlocksCompletionItems(
    queue: TempJsFileUpdateQueue,
    collectionItemProvider: CollectionItemProvider,
    logger?: OutputChannelLogger,
) {
    return languages.registerCompletionItemProvider(
        getRequestFileDocumentSelector(),
        {
            async provideCompletionItems(document, position, token) {
                const collection =
                    collectionItemProvider.getAncestorCollectionForPath(
                        document.fileName,
                    );

                if (!collection) {
                    return [];
                }

                const blocksToCheck = getCodeBlocks(
                    parseBruFile(new TextDocumentHelper(document.getText()))
                        .blocks,
                );

                const blockInBruFile = blocksToCheck.find(({ contentRange }) =>
                    mapToVsCodeRange(contentRange).contains(position),
                );

                if (!blockInBruFile) {
                    return undefined;
                }

                if (token.isCancellationRequested) {
                    logger?.debug(
                        `Cancellation requested for completion provider for code blocks.`,
                    );
                    return undefined;
                }

                const temporaryJsDoc =
                    await waitForTempJsFileToBeInSyncWithBruFile(
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
                        `Cancellation requested for completion provider for code blocks.`,
                    );
                    return undefined;
                }

                const resultFromJsFile =
                    await commands.executeCommand<CompletionList>(
                        "vscode.executeCompletionItemProvider",
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

                return new CompletionList<CompletionItem>(
                    resultFromJsFile.items.map((item) => ({
                        ...item,
                        range: item.range
                            ? item.range instanceof VsCodeRange
                                ? (mapToRangeWithinBruFile(
                                      blocksToCheck,
                                      temporaryJsDoc.getText(),
                                      item.range,
                                      logger,
                                  ) as VsCodeRange)
                                : {
                                      inserting: mapToRangeWithinBruFile(
                                          blocksToCheck,
                                          temporaryJsDoc.getText(),
                                          item.range.inserting,
                                          logger,
                                      ) as VsCodeRange,
                                      replacing: mapToRangeWithinBruFile(
                                          blocksToCheck,
                                          temporaryJsDoc.getText(),
                                          item.range.replacing,
                                          logger,
                                      ) as VsCodeRange,
                                  }
                            : undefined,
                        textEdit: item.textEdit
                            ? new TextEdit(
                                  mapToRangeWithinBruFile(
                                      blocksToCheck,
                                      temporaryJsDoc.getText(),
                                      item.textEdit.range,
                                  ) as VsCodeRange,
                                  item.textEdit.newText,
                              )
                            : undefined,
                    })),
                    resultFromJsFile.isIncomplete,
                );
            },
        },
        ".",
        "/",
    );
}
