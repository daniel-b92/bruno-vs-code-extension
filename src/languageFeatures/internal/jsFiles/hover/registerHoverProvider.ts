import { commands, Hover, languages } from "vscode";
import {
    CollectionItemProvider,
    mapFromVsCodePosition,
    mapToVsCodePosition,
    mapToVsCodeRange,
    OutputChannelLogger,
    Range,
} from "../../../../shared";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { getJsSourceFileDocumentSelector } from "../shared/getJsSourceFileDocumentSelector";
import { waitForTempJsFileToBeInSyncWithJsFile } from "../shared/waitForTempJsFileToBeInSyncWithJsFile";
import { getCorrespondingPositionInTempJsFile } from "../shared/getCorrespondingPositionInTempJsFile";
import { getCorrespondingPositionInSourceFile } from "../shared/getCorrespondingPositionInSourceFile";

export function registerHoverProvider(
    queue: TempJsFileUpdateQueue,
    itemProvider: CollectionItemProvider,
    logger?: OutputChannelLogger,
) {
    return languages.registerHoverProvider(getJsSourceFileDocumentSelector(), {
        async provideHover(document, positionInSourceFile, token) {
            if (!itemProvider.getAncestorCollectionForPath(document.fileName)) {
                return undefined;
            }

            if (token.isCancellationRequested) {
                logger?.debug(`Cancellation requested for hover provider.`);
                return undefined;
            }

            const temporaryJsDoc = await waitForTempJsFileToBeInSyncWithJsFile(
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

            const resultsFromTempJsFile = await commands.executeCommand<
                Hover[]
            >(
                "vscode.executeHoverProvider",
                temporaryJsDoc.uri,
                mapToVsCodePosition(
                    getCorrespondingPositionInTempJsFile(
                        mapFromVsCodePosition(positionInSourceFile),
                    ),
                ),
            );

            if (resultsFromTempJsFile.length == 0) {
                return null;
            }

            const range = resultsFromTempJsFile[0].range;

            return range
                ? new Hover(
                      resultsFromTempJsFile[0].contents,
                      mapToVsCodeRange(
                          new Range(
                              getCorrespondingPositionInSourceFile(
                                  mapFromVsCodePosition(range.start),
                              ),
                              getCorrespondingPositionInSourceFile(
                                  mapFromVsCodePosition(range.start),
                              ),
                          ),
                      ),
                  )
                : resultsFromTempJsFile[0];
        },
    });
}
