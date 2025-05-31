import { commands, Hover, languages, Uri, workspace } from "vscode";
import {
    CollectionItemProvider,
    mapRange,
    parseBruFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../shared";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { getCodeBlocks } from "../shared/codeBlocksUtils/getCodeBlocks";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { getTemporaryJsFileName } from "../shared/codeBlocksUtils/getTemporaryJsFileName";
import { isTempJsFileInSync } from "../shared/codeBlocksUtils/isTempJsFileInSync";
import { mapToRangeWithinBruFile } from "../shared/codeBlocksUtils/mapToRangeWithinBruFile";

export function provideInfosOnHover(
    collectionItemProvider: CollectionItemProvider
) {
    languages.registerHoverProvider(getRequestFileDocumentSelector(), {
        async provideHover(document, position) {
            const collection =
                collectionItemProvider.getAncestorCollectionForPath(
                    document.fileName
                );

            if (!collection) {
                return new Hover([]);
            }

            const blocksToCheck = getCodeBlocks(
                parseBruFile(new TextDocumentHelper(document.getText())).blocks
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
                    !isTempJsFileInSync(virtualJsDoc.getText(), blocksToCheck)
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

                const resultFromJsFile = await commands.executeCommand<Hover>(
                    "vscode.executeHoverProvider",
                    virtualJsDoc.uri,
                    getPositionWithinTempJsFile(
                        virtualJsDoc.getText(),
                        blockInBruFile.name as RequestFileBlockName,
                        position.translate(
                            -blockInBruFile.contentRange.start.line
                        )
                    )
                );

                return resultFromJsFile.range
                    ? new Hover(
                          resultFromJsFile.contents,
                          mapToRangeWithinBruFile(
                              blocksToCheck,
                              virtualJsDoc.getText(),
                              resultFromJsFile.range
                          )
                      )
                    : resultFromJsFile;
            }
        },
    });
}
