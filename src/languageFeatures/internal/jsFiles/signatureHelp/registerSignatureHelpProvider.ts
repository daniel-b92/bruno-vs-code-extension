import { commands, languages, SignatureHelp } from "vscode";
import {
    CollectionItemProvider,
    getTemporaryJsFileBasename,
    OutputChannelLogger,
} from "../../../../shared";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { getJsFileDocumentSelector } from "../shared/getJsFileDocumentSelector";
import { waitForTempJsFileToBeInSyncWithJsFile } from "../shared/waitForTempJsFileToBeInSyncWithJsFile";
import { getCorrespondingPositionInTempJsFile } from "../shared/getCorrespondingPositionInTempJsFile";

export function registerSignatureHelpProvider(
    queue: TempJsFileUpdateQueue,
    itemProvider: CollectionItemProvider,
    logger?: OutputChannelLogger,
) {
    return languages.registerSignatureHelpProvider(
        getJsFileDocumentSelector(),
        {
            async provideSignatureHelp(document, positionInSourceFile, token) {
                if (
                    // For temp js files, the Typescript language server provides the signature help already.
                    document.fileName.endsWith(getTemporaryJsFileBasename()) ||
                    !itemProvider.getAncestorCollectionForPath(
                        document.fileName,
                    )
                ) {
                    return undefined;
                }

                if (token.isCancellationRequested) {
                    logger?.debug(`Cancellation requested for hover provider.`);
                    return undefined;
                }

                const temporaryJsDoc =
                    await waitForTempJsFileToBeInSyncWithJsFile(
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

                return await commands.executeCommand<SignatureHelp>(
                    "vscode.executeSignatureHelpProvider",
                    temporaryJsDoc.uri,
                    getCorrespondingPositionInTempJsFile(positionInSourceFile),
                );
            },
        },
    );
}
