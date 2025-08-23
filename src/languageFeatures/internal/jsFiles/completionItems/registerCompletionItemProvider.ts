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
    OutputChannelLogger,
} from "../../../../shared";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { getJsSourceFileDocumentSelector } from "../shared/getJsSourceFileDocumentSelector";
import { waitForTempJsFileToBeInSyncWithJsFile } from "../shared/waitForTempJsFileToBeInSyncWithJsFile";
import { getCorrespondingPositionInTempJsFile } from "../shared/getCorrespondingPositionInTempJsFile";
import { getCorrespondingRangeInSourceFile } from "../shared/getCorrespondingRangeInSourceFile";

export function registerCompletionItemProvider(
    queue: TempJsFileUpdateQueue,
    itemProvider: CollectionItemProvider,
    logger?: OutputChannelLogger,
) {
    return languages.registerCompletionItemProvider(
        getJsSourceFileDocumentSelector(),
        {
            async provideCompletionItems(
                document,
                positionInSourceFile,
                token,
            ) {
                if (
                    !itemProvider.getAncestorCollectionForPath(
                        document.fileName,
                    )
                ) {
                    return undefined;
                }

                if (token.isCancellationRequested) {
                    logger?.debug(`Cancellation requested for hover provider.`);
                    return undefined;
                }

                const temporaryJsDoc =
                    await waitForTempJsFileToBeInSyncWithJsFile(
                        queue,
                        {
                            sourceFilePath: document.fileName,
                            sourceFileContentSnapshot: document.getText(),
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

                const resultFromJsFile =
                    await commands.executeCommand<CompletionList>(
                        "vscode.executeCompletionItemProvider",
                        temporaryJsDoc.uri,
                        getCorrespondingPositionInTempJsFile(
                            positionInSourceFile,
                        ),
                    );

                return new CompletionList<CompletionItem>(
                    resultFromJsFile.items.map((item) => ({
                        ...item,
                        range: item.range
                            ? item.range instanceof VsCodeRange
                                ? getCorrespondingRangeInSourceFile(item.range)
                                : {
                                      inserting:
                                          getCorrespondingRangeInSourceFile(
                                              item.range.inserting,
                                          ),
                                      replacing:
                                          getCorrespondingRangeInSourceFile(
                                              item.range.replacing,
                                          ),
                                  }
                            : undefined,
                        textEdit: item.textEdit
                            ? new TextEdit(
                                  getCorrespondingRangeInSourceFile(
                                      item.textEdit.range,
                                  ),
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
