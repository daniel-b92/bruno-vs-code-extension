import {
    languages,
    Uri,
    workspace,
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
} from "../../../shared";
import { getCodeBlocks } from "../shared/codeBlocksUtils/getCodeBlocks";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { getTemporaryJsFileName } from "../shared/codeBlocksUtils/getTemporaryJsFileName";
import { isTempJsFileInSync } from "../shared/codeBlocksUtils/isTempJsFileInSync";
import { mapToRangeWithinBruFile } from "../shared/codeBlocksUtils/mapToRangeWithinBruFile";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";

export function provideCodeBlocksCompletionItems(
    collectionItemProvider: CollectionItemProvider
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
                    return [];
                }

                const blocksToCheck = getCodeBlocks(
                    parseBruFile(new TextDocumentHelper(document.getText()))
                        .blocks
                );

                const blockInBruFile = blocksToCheck.find(({ contentRange }) =>
                    mapRange(contentRange).contains(position)
                );

                if (blockInBruFile) {
                    const virtualJsFileUri = Uri.file(
                        getTemporaryJsFileName(collection.getRootDirectory())
                    );

                    const virtualJsDoc = await workspace.openTextDocument(
                        virtualJsFileUri
                    );

                    // Sometimes it takes a short while until VS Code notices that the Javascript file has been modified externally
                    if (
                        !isTempJsFileInSync(
                            virtualJsDoc.getText(),
                            blocksToCheck
                        )
                    ) {
                        await new Promise<void>((resolve) => {
                            workspace.onDidChangeTextDocument((e) => {
                                if (
                                    e.document.uri.toString() ==
                                        virtualJsFileUri.toString() &&
                                    e.contentChanges.length > 0 &&
                                    isTempJsFileInSync(
                                        virtualJsDoc.getText(),
                                        blocksToCheck
                                    )
                                ) {
                                    resolve();
                                }
                            });
                        });
                    }

                    const resultFromJsFile =
                        await commands.executeCommand<CompletionList>(
                            "vscode.executeCompletionItemProvider",
                            virtualJsDoc.uri,
                            getPositionWithinTempJsFile(
                                virtualJsDoc.getText(),
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
                                          virtualJsDoc.getText(),
                                          item.range
                                      ) as VsCodeRange)
                                    : {
                                          inserting: mapToRangeWithinBruFile(
                                              blocksToCheck,
                                              virtualJsDoc.getText(),
                                              item.range.inserting
                                          ) as VsCodeRange,
                                          replacing: mapToRangeWithinBruFile(
                                              blocksToCheck,
                                              virtualJsDoc.getText(),
                                              item.range.replacing
                                          ) as VsCodeRange,
                                      }
                                : undefined,
                            textEdit: item.textEdit
                                ? new TextEdit(
                                      mapToRangeWithinBruFile(
                                          blocksToCheck,
                                          virtualJsDoc.getText(),
                                          item.textEdit.range
                                      ) as VsCodeRange,
                                      item.textEdit.newText
                                  )
                                : undefined,
                        })),
                        resultFromJsFile.isIncomplete
                    );
                } else {
                    return undefined;
                }
            },
        },
        ".",
        "/"
    );
}
