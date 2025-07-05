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
} from "../../../shared";
import { getCodeBlocks } from "../shared/codeBlocksUtils/getCodeBlocks";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { mapToRangeWithinBruFile } from "../shared/codeBlocksUtils/mapToRangeWithinBruFile";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { TemporaryJsFileSyncQueue } from "../shared/temporaryJsFileSyncQueue";

export function provideCodeBlocksCompletionItems(
    collectionItemProvider: CollectionItemProvider,
    tempJsFileSyncQueue: TemporaryJsFileSyncQueue,
    logger?: OutputChannelLogger
) {
    return languages.registerCompletionItemProvider(
        getRequestFileDocumentSelector(),
        {
            async provideCompletionItems(document, position) {
                const collection =
                    collectionItemProvider.getAncestorCollectionForPath(
                        document.fileName
                    );

                if (!collection) {
                    return undefined;
                }

                const contentSnapshot = document.getText();

                const blocksToCheck = getCodeBlocks(
                    parseBruFile(new TextDocumentHelper(contentSnapshot)).blocks
                );

                const blockInBruFile = blocksToCheck.find(({ contentRange }) =>
                    mapRange(contentRange).contains(position)
                );

                if (!blockInBruFile) {
                    return undefined;
                }

                const tempJsDoc = await tempJsFileSyncQueue.addToQueue({
                    collection,
                    bruFilePath: document.fileName,
                    bruFileContent: contentSnapshot,
                    bruFileCodeBlocks: blocksToCheck,
                });

                if (!tempJsDoc) {
                    return undefined;
                }

                const resultFromJsFile =
                    await commands.executeCommand<CompletionList>(
                        "vscode.executeCompletionItemProvider",
                        tempJsDoc.uri,
                        getPositionWithinTempJsFile(
                            tempJsDoc.getText(),
                            blockInBruFile.name as RequestFileBlockName,
                            position.translate(
                                -blockInBruFile.contentRange.start.line
                            )
                        )
                    );

                return new CompletionList<CompletionItem>(
                    resultFromJsFile.items.map((item) => ({
                        ...item,
                        range: item.range
                            ? item.range instanceof VsCodeRange
                                ? (mapToRangeWithinBruFile(
                                      blocksToCheck,
                                      tempJsDoc.getText(),
                                      item.range,
                                      logger
                                  ) as VsCodeRange)
                                : {
                                      inserting: mapToRangeWithinBruFile(
                                          blocksToCheck,
                                          tempJsDoc.getText(),
                                          item.range.inserting,
                                          logger
                                      ) as VsCodeRange,
                                      replacing: mapToRangeWithinBruFile(
                                          blocksToCheck,
                                          tempJsDoc.getText(),
                                          item.range.replacing,
                                          logger
                                      ) as VsCodeRange,
                                  }
                            : undefined,
                        textEdit: item.textEdit
                            ? new TextEdit(
                                  mapToRangeWithinBruFile(
                                      blocksToCheck,
                                      tempJsDoc.getText(),
                                      item.textEdit.range
                                  ) as VsCodeRange,
                                  item.textEdit.newText
                              )
                            : undefined,
                    })),
                    resultFromJsFile.isIncomplete
                );
            },
        },
        ".",
        "/"
    );
}
