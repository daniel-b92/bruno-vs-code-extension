import {
    CancellationToken,
    Disposable,
    EndOfLine,
    TextDocument,
    Uri,
    workspace,
} from "vscode";
import {
    TextDocumentHelper,
    getTemporaryJsFileNameInFolder,
} from "@global_shared";
import { OutputChannelLogger, TypedCollection } from "@shared";
import { TempJsFileUpdateQueue } from "./tempJsFileUpdateQueue";
import { TempJsUpdateType } from "../internal/interfaces";
import { basename } from "path";
import { getTempJsFileContentForBruFile } from "../../../brunoFiles/shared/codeBlocksUtils/getTempJsFileContentForBruFile";

export interface TempJsSyncRequest {
    collection: TypedCollection;
    bruFileContentSnapshot: string;
    bruFilePath: string;
    bruFileEol: EndOfLine;
    token?: CancellationToken;
}

export async function waitForTempJsFileToBeInSync(
    queue: TempJsFileUpdateQueue,
    request: TempJsSyncRequest,
    logger?: OutputChannelLogger,
): Promise<TextDocument | undefined> {
    const {
        bruFilePath,
        bruFileContentSnapshot,
        bruFileEol,
        collection,
        token,
    } = request;
    const tempJsFilePath = getTemporaryJsFileNameInFolder(
        collection.getRootDirectory(),
    );

    const desiredTempJsFileContentInitially = getTempJsFileContentForBruFile(
        bruFileContentSnapshot,
        bruFileEol,
    );

    if (shouldAbort(token)) {
        addLogEntryForAbortion(logger);
        return undefined;
    }

    const shouldContinue = await queue.addToQueue({
        update: {
            type: TempJsUpdateType.Creation,
            filePath: tempJsFilePath,
            tempJsFileContent: desiredTempJsFileContentInitially,
        },
        cancellationToken: token,
    });

    if (!shouldContinue) {
        logger?.debug(
            "Cancellation returned while trying to add temp js file update request to queue.",
        );
        return undefined;
    }

    const virtualJsFileUri = Uri.file(tempJsFilePath);

    if (shouldAbort(token)) {
        addLogEntryForAbortion(logger);
        return undefined;
    }
    const jsDocInitially = await workspace.openTextDocument(virtualJsFileUri);

    // Sometimes it takes a short while until VS Code notices that the Javascript file has been modified externally
    if (
        isConditionFulfilled(jsDocInitially, desiredTempJsFileContentInitially)
    ) {
        logger?.trace(`Temp JS file in sync on first check.`);
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
        if (token) {
            toDispose.push(
                token.onCancellationRequested(() => {
                    addLogEntryForAbortion(logger);
                    resolve({ shouldRetry: false });
                }),
            );
        }

        toDispose.push(
            workspace.onDidChangeTextDocument((e) => {
                if (
                    e.document.uri.toString() == virtualJsFileUri.toString() &&
                    e.contentChanges.length > 0 &&
                    isConditionFulfilled(
                        jsDocInitially,
                        desiredTempJsFileContentInitially,
                    )
                ) {
                    logger?.trace(
                        `Temp JS file in sync after waiting for ${Math.round(
                            performance.now() - startTime,
                        )} ms.`,
                    );
                    resolve({ document: e.document });
                } else if (
                    e.document.uri.fsPath == bruFilePath &&
                    e.contentChanges.length > 0
                ) {
                    logger?.debug(
                        `Aborting waiting for temp Js file to be in sync because source file '${basename(bruFilePath)}' has been modified.`,
                    );
                    resolve({ shouldRetry: true });
                }
            }),
        );

        // If the source file is modified or deleted in the meantime, the request will be outdated, so it can be canceled.
        toDispose.push(
            workspace.onDidDeleteFiles((e) => {
                if (e.files.some(({ fsPath }) => fsPath == bruFilePath)) {
                    logger?.debug(
                        `Aborting waiting for temp Js file to be in sync because source file '${basename(bruFilePath)}' has been deleted.`,
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

        const currentBruFileDoc = await workspace.openTextDocument(
            Uri.file(bruFilePath),
        );

        const newBruFileContentSnapshot = currentBruFileDoc.getText();

        return await waitForTempJsFileToBeInSync(
            queue,
            {
                ...request,
                bruFileContentSnapshot: newBruFileContentSnapshot,
            },
            logger,
        );
    } else {
        return currentJsDoc;
    }
}

function isConditionFulfilled(
    currentJsDocument: TextDocument,
    desiredTempJsContent: string,
) {
    const actualLines = new TextDocumentHelper(
        currentJsDocument.getText(),
    ).getAllLines();
    const desiredLines = new TextDocumentHelper(
        desiredTempJsContent,
    ).getAllLines();

    return (
        actualLines.length == desiredLines.length &&
        actualLines.every(
            ({ content: actual }, index) =>
                actual == desiredLines[index].content,
        )
    );
}

function shouldAbort(token?: CancellationToken) {
    return token && token.isCancellationRequested;
}

function addLogEntryForAbortion(logger?: OutputChannelLogger) {
    logger?.debug(
        "Cancellation requested after starting to wait for temp js file to be in sync.",
    );
}
