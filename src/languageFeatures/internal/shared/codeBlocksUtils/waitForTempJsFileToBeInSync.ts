import {
    CancellationToken,
    Disposable,
    TextDocument,
    Uri,
    workspace,
} from "vscode";
import {
    Block,
    getTemporaryJsFileName,
    OutputChannelLogger,
    parseBruFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../../shared";
import { getCodeBlocks } from "./getCodeBlocks";
import { getTempJsFileBlockContent } from "./getTempJsFileBlockContent";
import { TempJsSyncRequest } from "./interfaces";
import { TempJsFileUpdateQueue } from "../temporaryJsFilesUpdates/tempJsFileUpdateQueue";
import { TempJsUpdateType } from "../temporaryJsFilesUpdates/internal/interfaces";

export async function waitForTempJsFileToBeInSync(
    queue: TempJsFileUpdateQueue,
    request: TempJsSyncRequest,
    logger?: OutputChannelLogger,
): Promise<TextDocument | undefined> {
    const {
        bruFileCodeBlocksSnapshot,
        bruFilePath,
        bruFileContentSnapshot,
        collection,
        token,
    } = request;

    if (shouldAbort(token)) {
        addLogEntryForAbortion(logger);
        return undefined;
    }

    queue.addToQueue({
        collectionRootFolder: collection.getRootDirectory(),
        update: {
            type: TempJsUpdateType.Creation,
            bruFileContent: bruFileContentSnapshot,
        },
        cancellationToken: token,
    });

    const virtualJsFileUri = Uri.file(
        getTemporaryJsFileName(collection.getRootDirectory()),
    );

    if (shouldAbort(token)) {
        addLogEntryForAbortion(logger);
        return undefined;
    }
    const jsDocInitially = await workspace.openTextDocument(virtualJsFileUri);

    // Sometimes it takes a short while until VS Code notices that the Javascript file has been modified externally
    if (
        isTempJsFileInSync(jsDocInitially.getText(), bruFileCodeBlocksSnapshot)
    ) {
        logger?.debug(`Temp JS file in sync on first check.`);
        return jsDocInitially;
    }

    const toDispose: Disposable[] = [];

    const startTime = performance.now();

    if (shouldAbort(token)) {
        addLogEntryForAbortion(logger);
        return undefined;
    }

    const { document: currentJsDoc, shouldRetry } = await new Promise<{
        document?: TextDocument;
        shouldRetry?: boolean;
    }>((resolve) => {
        toDispose.push(
            token.onCancellationRequested(() => {
                addLogEntryForAbortion(logger);
                resolve({ shouldRetry: false });
            }),
        );

        toDispose.push(
            workspace.onDidChangeTextDocument((e) => {
                if (
                    e.document.uri.toString() == virtualJsFileUri.toString() &&
                    e.contentChanges.length > 0 &&
                    isTempJsFileInSync(
                        jsDocInitially.getText(),
                        bruFileCodeBlocksSnapshot,
                    )
                ) {
                    logger?.debug(
                        `Temp JS file in sync after waiting for ${
                            performance.now() - startTime
                        } ms.`,
                    );
                    resolve({ document: e.document });
                } else if (
                    e.document.uri.fsPath.toString() ==
                        bruFilePath.toString() &&
                    e.contentChanges.length > 0
                ) {
                    logger?.debug(
                        `Aborting waiting for temp Js file to be in sync because bru file has been modified.`,
                    );
                    resolve({ shouldRetry: true });
                }
            }),
        );

        // If the bruno file is modified or deleted in the meantime, the request will be outdated, so it can be canceled.
        toDispose.push(
            workspace.onDidDeleteFiles((e) => {
                if (e.files.some(({ fsPath }) => fsPath == bruFilePath)) {
                    logger?.debug(
                        `Aborting waiting for temp Js file to be in sync because bru file has been deleted.`,
                    );
                    resolve({ shouldRetry: false });
                }
            }),
        );

        // VS Code can close the text document anytime.
        // Exceptions may be thrown when trying to read from the doc after it has been closed.
        toDispose.push(
            workspace.onDidCloseTextDocument((doc) => {
                if (doc.uri.toString() == virtualJsFileUri.toString()) {
                    logger?.debug(
                        `Temp Js document has been closed. Need to start a retry for waiting for it to be in sync.`,
                    );
                    resolve({ shouldRetry: true });
                }
            }),
        );
    });

    toDispose.forEach((disposable) => disposable.dispose());

    if (!currentJsDoc && shouldRetry) {
        if (shouldAbort(token)) {
            addLogEntryForAbortion(logger);
            return undefined;
        }

        const currentBrunoDoc = await workspace.openTextDocument(
            Uri.file(bruFilePath),
        );

        const newBruContentSnapshot = currentBrunoDoc.getText();

        return await waitForTempJsFileToBeInSync(
            queue,
            {
                ...request,
                bruFileContentSnapshot: newBruContentSnapshot,
                bruFileCodeBlocksSnapshot: getCodeBlocks(
                    parseBruFile(new TextDocumentHelper(newBruContentSnapshot))
                        .blocks,
                ),
            },
            logger,
        );
    } else {
        return currentJsDoc;
    }
}

function shouldAbort(token: CancellationToken) {
    return token.isCancellationRequested;
}

function addLogEntryForAbortion(logger?: OutputChannelLogger) {
    logger?.debug(
        "Cancellation requested after starting to wait for temp js file to be in sync.",
    );
}

function isTempJsFileInSync(
    tempJsFileFullContent: string,
    relevantBlocksFromBruFile: Block[],
) {
    const blocksFromBruFile = getCodeBlocks(relevantBlocksFromBruFile);

    return blocksFromBruFile.every(({ name, content: bruFileBlockContent }) => {
        const jsFileBlock = getTempJsFileBlockContent(
            tempJsFileFullContent,
            name as RequestFileBlockName,
        );

        if (!jsFileBlock) {
            return false;
        }

        return jsFileBlock.content == bruFileBlockContent;
    });
}
