import { commands, Hover, languages } from "vscode";
import {
    CollectionItemProvider,
    OutputChannelLogger,
} from "../../../../shared";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { getJsSourceFileDocumentSelector } from "../shared/getJsSourceFileDocumentSelector";
import { waitForTempJsFileToBeInSyncWithJsFile } from "../shared/waitForTempJsFileToBeInSyncWithJsFile";
import { getCorrespondingPositionInTempJsFile } from "../shared/getCorrespondingPositionInTempJsFile";
import { getCorrespondingRangeInSourceFile } from "../shared/getCorrespondingRangeInSourceFile";

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
                getCorrespondingPositionInTempJsFile(positionInSourceFile),
            );

            if (resultsFromTempJsFile.length == 0) {
                return null;
            }

            const range = resultsFromTempJsFile[0].range;

            return range
                ? new Hover(
                      resultsFromTempJsFile[0].contents,
                      getCorrespondingRangeInSourceFile(range),
                  )
                : resultsFromTempJsFile[0];
        },
    });
}
