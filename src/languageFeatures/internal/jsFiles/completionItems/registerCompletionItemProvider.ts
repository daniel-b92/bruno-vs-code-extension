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
    getTemporaryJsFileBasename,
    OutputChannelLogger,
} from "../../../../shared";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { getJsFileDocumentSelector } from "../shared/getJsFileDocumentSelector";
import { waitForTempJsFileToBeInSyncWithJsFile } from "../shared/waitForTempJsFileToBeInSyncWithJsFile";
import { getCorrespondingPositionInTempJsFile } from "../shared/getCorrespondingPositionInTempJsFile";
import { getCorrespondingRangeInSourceFile } from "../shared/getCorrespondingRangeInSourceFile";

export function registerCompletionItemProvider(
    queue: TempJsFileUpdateQueue,
    itemProvider: CollectionItemProvider,
    logger?: OutputChannelLogger,
) {
    return languages.registerCompletionItemProvider(
        getJsFileDocumentSelector(),
        {
            async provideCompletionItems(
                document,
                positionInSourceFile,
                token,
            ) {
                if (
                    // For temp js files, the Typescript language server provides the completion items already.
                document.fileName.endsWith(getTemporaryJsFileBasename()) ||
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
