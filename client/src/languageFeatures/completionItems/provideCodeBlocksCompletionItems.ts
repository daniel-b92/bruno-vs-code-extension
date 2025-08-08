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
    mapRange,
    RequestFileBlockName,
    OutputChannelLogger,
} from "../../../../shared";
import { getCodeBlocks } from "../shared/codeBlocksUtils/getCodeBlocks";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { mapToRangeWithinBruFile } from "../shared/codeBlocksUtils/mapToRangeWithinBruFile";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { waitForTempJsFileToBeInSync } from "../shared/codeBlocksUtils/waitForTempJsFileToBeInSync";
import { TempJsFileUpdateQueue } from "../shared/temporaryJsFilesUpdates/tempJsFileUpdateQueue";

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
                    mapRange(contentRange).contains(position),
                );

                if (blockInBruFile) {
                    if (token.isCancellationRequested) {
                        logger?.debug(
                            `Cancellation requested for completion provider for code blocks.`,
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
                                position.translate(
                                    -blockInBruFile.contentRange.start.line,
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
                } else {
                    return undefined;
                }
            },
        },
        ".",
        "/",
    );
}
