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
} from "../../../shared";
import { getCodeBlocks } from "../shared/codeBlocksUtils/getCodeBlocks";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { mapToRangeWithinBruFile } from "../shared/codeBlocksUtils/mapToRangeWithinBruFile";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { waitForTempJsFileToBeInSync } from "../shared/codeBlocksUtils/waitForTempJsFileToBeInSync";
import { TemporaryJsFilesRegistry } from "../shared/temporaryJsFilesRegistry";

export function provideCodeBlocksCompletionItems(
    collectionItemProvider: CollectionItemProvider,
    tempJsFilesRegistry: TemporaryJsFilesRegistry
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
                    const temporaryJsDoc = await waitForTempJsFileToBeInSync(
                        tempJsFilesRegistry,
                        collection,
                        document.getText(),
                        blocksToCheck,
                        document.fileName
                    );

                    if (!temporaryJsDoc) {
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
                                          temporaryJsDoc.getText(),
                                          item.range
                                      ) as VsCodeRange)
                                    : {
                                          inserting: mapToRangeWithinBruFile(
                                              blocksToCheck,
                                              temporaryJsDoc.getText(),
                                              item.range.inserting
                                          ) as VsCodeRange,
                                          replacing: mapToRangeWithinBruFile(
                                              blocksToCheck,
                                              temporaryJsDoc.getText(),
                                              item.range.replacing
                                          ) as VsCodeRange,
                                      }
                                : undefined,
                            textEdit: item.textEdit
                                ? new TextEdit(
                                      mapToRangeWithinBruFile(
                                          blocksToCheck,
                                          temporaryJsDoc.getText(),
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
