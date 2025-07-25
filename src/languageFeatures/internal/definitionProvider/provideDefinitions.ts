import {
    commands,
    Definition,
    DefinitionLink,
    languages,
    Location,
    LocationLink,
} from "vscode";
import {
    CollectionItemProvider,
    mapRange,
    OutputChannelLogger,
    parseBruFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../shared";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { getCodeBlocks } from "../shared/codeBlocksUtils/getCodeBlocks";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { TemporaryJsFilesRegistry } from "../shared/temporaryJsFilesRegistry";
import { waitForTempJsFileToBeInSync } from "../shared/codeBlocksUtils/waitForTempJsFileToBeInSync";

export function provideDefinitions(
    collectionItemProvider: CollectionItemProvider,
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    logger?: OutputChannelLogger
) {
    return languages.registerDefinitionProvider(
        getRequestFileDocumentSelector(),
        {
            async provideDefinition(document, position, token) {
                const collection =
                    collectionItemProvider.getAncestorCollectionForPath(
                        document.fileName
                    );

                if (!collection) {
                    return null;
                }

                const blocksToCheck = getCodeBlocks(
                    parseBruFile(new TextDocumentHelper(document.getText()))
                        .blocks
                );

                const blockInBruFile = blocksToCheck.find(({ contentRange }) =>
                    mapRange(contentRange).contains(position)
                );

                if (blockInBruFile) {
                    if (token.isCancellationRequested) {
                        logger?.debug(
                            `Cancellation requested for definitions provider.`
                        );
                        return undefined;
                    }

                    const temporaryJsDoc = await waitForTempJsFileToBeInSync(
                        tempJsFilesRegistry,
                        collection,
                        document.getText(),
                        blocksToCheck,
                        document.fileName,
                        token,
                        logger
                    );

                    if (!temporaryJsDoc) {
                        return undefined;
                    }

                    if (token.isCancellationRequested) {
                        logger?.debug(
                            `Cancellation requested for definitions provider.`
                        );
                        return undefined;
                    }

                    const resultFromJsFile = await commands.executeCommand<
                        (Location | LocationLink)[]
                    >(
                        "vscode.executeDefinitionProvider",
                        temporaryJsDoc.uri,
                        getPositionWithinTempJsFile(
                            temporaryJsDoc.getText(),
                            blockInBruFile.name as RequestFileBlockName,
                            position.translate(
                                -blockInBruFile.contentRange.start.line
                            )
                        )
                    );

                    if (resultFromJsFile.length == 0) {
                        return [];
                    }

                    const relevantLocations = resultFromJsFile.filter(
                        (val) =>
                            val instanceof Location &&
                            val.uri.toString() != temporaryJsDoc.uri.toString()
                    );

                    return relevantLocations.length > 0
                        ? (relevantLocations as Definition)
                        : (resultFromJsFile.filter(
                              (val) =>
                                  !(val instanceof Location) &&
                                  val.targetUri.toString() !=
                                      temporaryJsDoc.uri.toString()
                          ) as DefinitionLink[]);
                }
            },
        }
    );
}
