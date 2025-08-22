import { CancellationToken, TextDocument } from "vscode";
import {
    Block,
    Collection,
    getTemporaryJsFileNameForBruFile,
    OutputChannelLogger,
} from "../../../../shared";
import { TempJsFileUpdateQueue } from "../temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { getMappedTempJsFileContent } from "./getMappedTempJsFileContent";
import { waitForTempJsFileToBeInSync } from "../temporaryJsFilesUpdates/external/waitForTempJsFileToBeInSync";

export interface TempJsSyncRequestForBruFile {
    collection: Collection;
    bruFileContentSnapshot: string;
    bruFileCodeBlocksSnapshot: Block[];
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
            sourceFleContentSnapshot: bruFileContentSnapshot,
            tempJsFilePath: getTemporaryJsFileNameForBruFile(
                collection.getRootDirectory(),
            ),
            getDesiredTempJsFileContent: getMappedTempJsFileContent,
            token,
        },
        logger,
    );
}
