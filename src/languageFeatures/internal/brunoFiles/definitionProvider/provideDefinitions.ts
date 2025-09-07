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
    mapFromVsCodePosition,
    OutputChannelLogger,
    RequestFileBlockName,
} from "../../../../shared";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { waitForTempJsFileToBeInSyncWithBruFile } from "../shared/codeBlocksUtils/waitForTempJsFileToBeInSyncWithBruFile";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { getCodeBlockContainingPosition } from "../shared/codeBlocksUtils/getCodeBlockContainingPosition";

export function provideDefinitions(
    queue: TempJsFileUpdateQueue,
    collectionItemProvider: CollectionItemProvider,
    logger?: OutputChannelLogger,
) {
    return languages.registerDefinitionProvider(
        getRequestFileDocumentSelector(),
        {
            async provideDefinition(document, position, token) {
                const collection =
                    collectionItemProvider.getAncestorCollectionForPath(
                        document.fileName,
                    );

                if (!collection) {
                    return null;
                }

                const blockInBruFile = getCodeBlockContainingPosition(
                    document.getText(),
                    position,
                );

                if (!blockInBruFile) {
                    return undefined;
                }

                if (token.isCancellationRequested) {
                    logger?.debug(
                        `Cancellation requested for definitions provider.`,
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
                        `Cancellation requested for definitions provider.`,
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
                        mapFromVsCodePosition(
                            position.translate(
                                -blockInBruFile.contentRange.start.line,
                            ),
                        ),
                    ),
                );

                if (resultFromJsFile.length == 0) {
                    return [];
                }

                const relevantLocations = resultFromJsFile.filter(
                    (val) =>
                        val instanceof Location &&
                        val.uri.toString() != temporaryJsDoc.uri.toString(),
                );

                return relevantLocations.length > 0
                    ? (relevantLocations as Definition)
                    : (resultFromJsFile.filter(
                          (val) =>
                              !(val instanceof Location) &&
                              val.targetUri.toString() !=
                                  temporaryJsDoc.uri.toString(),
                      ) as DefinitionLink[]);
            },
        },
    );
}
