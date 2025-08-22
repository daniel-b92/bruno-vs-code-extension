import { CancellationToken, TextDocument } from "vscode";
import {
    Collection,
    getTemporaryJsFileNameInFolder,
    OutputChannelLogger,
} from "../../../../../shared";
import { TempJsFileUpdateQueue } from "../../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { getTempJsFileContentForBruFile } from "./getTempJsFileContentForBruFile";
import { waitForTempJsFileToBeInSync } from "../../../shared/temporaryJsFilesUpdates/external/waitForTempJsFileToBeInSync";

export interface TempJsSyncRequestForBruFile {
    collection: Collection;
    bruFileContentSnapshot: string;
    bruFilePath: string;
    token?: CancellationToken;
}

export async function waitForTempJsFileToBeInSyncWithBruFile(
    queue: TempJsFileUpdateQueue,
    request: TempJsSyncRequestForBruFile,
    logger?: OutputChannelLogger,
): Promise<TextDocument | undefined> {
    const { collection, bruFilePath, bruFileContentSnapshot, token } = request;

    return waitForTempJsFileToBeInSync(
        queue,
        {
            sourceFilePath: bruFilePath,
            sourceFileContentSnapshot: bruFileContentSnapshot,
            tempJsFilePath: getTemporaryJsFileNameInFolder(
                collection.getRootDirectory(),
            ),
            getDesiredTempJsFileContent: getTempJsFileContentForBruFile,
            token,
        },
        logger,
    );
}
