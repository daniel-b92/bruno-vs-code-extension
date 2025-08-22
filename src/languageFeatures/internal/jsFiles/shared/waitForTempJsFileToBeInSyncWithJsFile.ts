import { CancellationToken, TextDocument } from "vscode";
import {
    getTemporaryJsFileNameInFolder,
    OutputChannelLogger,
} from "../../../../shared";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { waitForTempJsFileToBeInSync } from "../../shared/temporaryJsFilesUpdates/external/waitForTempJsFileToBeInSync";
import { dirname } from "path";
import { getDefinitionsForInbuiltLibraries } from "../../shared/getDefinitionsForInbuiltLibraries";

export interface TempJsSyncRequestForJsFile {
    sourceFilePath: string;
    sourceFileContentSnapshot: string;
    token?: CancellationToken;
}

export async function waitForTempJsFileToBeInSyncWithJsFile(
    queue: TempJsFileUpdateQueue,
    request: TempJsSyncRequestForJsFile,
    logger?: OutputChannelLogger,
): Promise<TextDocument | undefined> {
    const { sourceFilePath, sourceFileContentSnapshot, token } = request;

    return waitForTempJsFileToBeInSync(
        queue,
        {
            sourceFilePath,
            sourceFileContentSnapshot,
            tempJsFilePath: getTemporaryJsFileNameInFolder(
                dirname(sourceFilePath),
            ),
            getDesiredTempJsFileContent: (sourceFileContent: string) =>
                getDefinitionsForInbuiltLibraries()
                    .concat(sourceFileContent)
                    .join("\n\n"),
            token,
        },
        logger,
    );
}
