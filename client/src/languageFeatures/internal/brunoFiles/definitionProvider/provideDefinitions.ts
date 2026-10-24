import {
    commands,
    Definition,
    DefinitionLink,
    languages,
    DocumentSelector,
    Location,
    LocationLink,
} from "vscode";
import {
    mapFromVsCodePosition,
    OutputChannelLogger,
    TypedCollectionItemProvider,
} from "@shared";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { getCodeBlockContainingPosition } from "../shared/codeBlocksUtils/getCodeBlockContainingPosition";
import { waitForTempJsFileToBeInSync } from "../../shared/temporaryJsFilesUpdates/external/waitForTempJsFileToBeInSync";

export function provideDefinitions(
    documentSelector: DocumentSelector,
    queue: TempJsFileUpdateQueue,
    collectionItemProvider: TypedCollectionItemProvider,
    ensureCacheIsReady: () => Promise<void>,
    logger?: OutputChannelLogger,
) {
    return languages.registerDefinitionProvider(documentSelector, {
        async provideDefinition(document, position, token) {
            await ensureCacheIsReady();

            const collection =
                collectionItemProvider.getAncestorCollectionForPath(
                    document.fileName,
                );
            const itemType = collection
                ?.getStoredDataForPath(document.fileName)
                ?.item.getItemType();

            if (!collection || !itemType) {
                return null;
            }

            const blockInSourceFile = getCodeBlockContainingPosition(
                document.getText(),
                position,
                itemType,
                collection.getFormat(),
            );

            if (!blockInSourceFile) {
                return undefined;
            }

            if (token.isCancellationRequested) {
                logger?.debug(
                    `Cancellation requested for definitions provider.`,
                );
                return undefined;
            }

            const temporaryJsDoc = await waitForTempJsFileToBeInSync(
                queue,
                {
                    collection,
                    sourceFileContentSnapshot: document.getText(),
                    sourceFilePath: document.fileName,
                    sourceFileEol: document.eol,
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
                    blockInSourceFile.name,
                    mapFromVsCodePosition(
                        position.translate(
                            -blockInSourceFile.contentRange.start.line,
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
    });
}
