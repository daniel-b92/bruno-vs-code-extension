import { commands, Hover, languages } from "vscode";
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
import { mapToRangeWithinBruFile } from "../shared/codeBlocksUtils/mapToRangeWithinBruFile";
import { TemporaryJsFilesRegistry } from "../shared/temporaryJsFilesRegistry";
import { waitForTempJsFileToBeInSync } from "../shared/codeBlocksUtils/waitForTempJsFileToBeInSync";

export function provideInfosOnHover(
    collectionItemProvider: CollectionItemProvider,
    tempJsFilesRegistry: TemporaryJsFilesRegistry
) {
    return languages.registerHoverProvider(getRequestFileDocumentSelector(), {
        async provideHover(document, position) {
            const collection =
                collectionItemProvider.getAncestorCollectionForPath(
                    document.fileName
                );

            if (!collection) {
                return null;
            }

            const blocksToCheck = getCodeBlocks(
                parseBruFile(new TextDocumentHelper(document.getText())).blocks
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

                const resultFromJsFile = await commands.executeCommand<Hover[]>(
                    "vscode.executeHoverProvider",
                    temporaryJsDoc.uri,
                    getPositionWithinTempJsFile(
                        temporaryJsDoc.getText(),
                        blockInBruFile.name as RequestFileBlockName,
                        position.translate(
                            -blockInBruFile.contentRange.start.line
                        )
                    )
                );

                return resultFromJsFile.length == 0
                    ? null
                    : resultFromJsFile[0].range
                    ? new Hover(
                          resultFromJsFile[0].contents,
                          mapToRangeWithinBruFile(
                              blocksToCheck,
                              temporaryJsDoc.getText(),
                              resultFromJsFile[0].range
                          )
                      )
                    : resultFromJsFile[0];
            }
        },
    });
}
