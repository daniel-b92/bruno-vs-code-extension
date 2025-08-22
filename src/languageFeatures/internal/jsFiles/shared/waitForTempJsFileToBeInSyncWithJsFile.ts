import { CancellationToken, TextDocument } from "vscode";
import {
    getTemporaryJsFileNameInFolder,
    OutputChannelLogger,
} from "../../../../shared";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { waitForTempJsFileToBeInSync } from "../../shared/temporaryJsFilesUpdates/external/waitForTempJsFileToBeInSync";
import { dirname } from "path";
import { mapSourceFileToTempJsFileContent } from "./mapSourceFileToTempJsFileContent";

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
            getDesiredTempJsFileContent: mapSourceFileToTempJsFileContent,
            token,
        },
        logger,
    );
}
