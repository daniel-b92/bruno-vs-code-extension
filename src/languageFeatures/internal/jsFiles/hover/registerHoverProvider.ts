import { commands, Hover, languages } from "vscode";
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

export function registerHoverProvider(
    queue: TempJsFileUpdateQueue,
    itemProvider: CollectionItemProvider,
    logger?: OutputChannelLogger,
) {
    return languages.registerHoverProvider(getJsFileDocumentSelector(), {
        async provideHover(document, positionInSourceFile, token) {
            if (
                // For temp js files, the Typescript language server provides hovers already.
                document.fileName.endsWith(getTemporaryJsFileBasename()) ||
                !itemProvider.getAncestorCollectionForPath(document.fileName)
            ) {
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
