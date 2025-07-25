import {
    CancellationToken,
    Disposable,
    TextDocument,
    Uri,
    workspace,
} from "vscode";
import {
    Block,
    checkIfPathExistsAsync,
    Collection,
    getTemporaryJsFileName,
    normalizeDirectoryPath,
    OutputChannelLogger,
    parseBruFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../../shared";
import { TemporaryJsFilesRegistry } from "../temporaryJsFilesRegistry";
import { createTemporaryJsFile } from "./createTemporaryJsFile";
import { getCodeBlocks } from "./getCodeBlocks";
import { getTempJsFileBlockContent } from "./getTempJsFileBlockContent";

export async function waitForTempJsFileToBeInSync(
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    collection: Collection,
    bruFileContentSnapshot: string,
    bruFileCodeBlocksSnapshot: Block[],
    bruFilePath: string,
    token: CancellationToken,
    logger?: OutputChannelLogger
): Promise<TextDocument | undefined> {
    if (shouldAbort(token)) {
        addLogEntryForAbortion(logger);
        return undefined;
    }

    await createTemporaryJsFileIfNotAlreadyExisting(
        tempJsFilesRegistry,
        collection,
        bruFileContentSnapshot,
        logger
    );

    const virtualJsFileUri = Uri.file(
        getTemporaryJsFileName(collection.getRootDirectory())
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

    // Fallback mechanism for updating the temporary js file, in case it for some reason did not work by the default mechanism.
    const timeout = setTimeout(() => {
        logger?.debug(
            "Fallback mechanism triggered for updating temp js file after timeout has been reached."
        );

        createTemporaryJsFile(
            collection.getRootDirectory(),
            tempJsFilesRegistry,
            bruFileContentSnapshot,
            logger
        );
    }, 10_000);

    const startTime = performance.now();

    if (shouldAbort(token)) {
        addLogEntryForAbortion(logger);
        clearTimeout(timeout);
        return undefined;
    }

    const { document: currentJsDoc, shouldRetry } = await new Promise<{
        document?: TextDocument;
        shouldRetry?: boolean;
    }>((resolve) => {
        toDispose.push(
            token.onCancellationRequested(() => {
                addLogEntryForAbortion(logger);
                clearTimeout(timeout);
                resolve({ shouldRetry: false });
            })
        );

        toDispose.push(
            workspace.onDidChangeTextDocument((e) => {
                if (
                    e.document.uri.toString() == virtualJsFileUri.toString() &&
                    e.contentChanges.length > 0 &&
                    isTempJsFileInSync(
                        jsDocInitially.getText(),
                        bruFileCodeBlocksSnapshot
                    )
                ) {
                    logger?.debug(
                        `Temp JS file in sync after waiting for ${
                            performance.now() - startTime
                        } ms.`
                    );
                    clearTimeout(timeout);
                    resolve({ document: e.document });
                } else if (
                    e.document.uri.fsPath.toString() ==
                        bruFilePath.toString() &&
                    e.contentChanges.length > 0
                ) {
                    logger?.debug(
                        `Aborting waiting for temp Js file to be in sync because bru file has been modified.`
                    );
                    clearTimeout(timeout);
                    resolve({ shouldRetry: true });
                }
            })
        );

        // If the bruno file is modified or deleted in the meantime, the request will be outdated, so it can be canceled.
        toDispose.push(
            workspace.onDidDeleteFiles((e) => {
                if (e.files.some(({ fsPath }) => fsPath == bruFilePath)) {
                    logger?.debug(
                        `Aborting waiting for temp Js file to be in sync because bru file has been deleted.`
                    );
                    clearTimeout(timeout);
                    resolve({ shouldRetry: false });
                }
            })
        );

        // VS Code can close the text document anytime.
        // Exceptions may be thrown when trying to read from the doc after it has been closed.
        toDispose.push(
            workspace.onDidCloseTextDocument((doc) => {
                if (doc.uri.toString() == virtualJsFileUri.toString()) {
                    logger?.debug(
                        `Temp Js document has been closed. Need to start a retry for waiting for it to be in sync.`
                    );
                    clearTimeout(timeout);
                    resolve({ shouldRetry: true });
                }
            })
        );
    });

    toDispose.forEach((disposable) => disposable.dispose());

    if (!currentJsDoc && shouldRetry) {
        if (shouldAbort(token)) {
            addLogEntryForAbortion(logger);
            clearTimeout(timeout);
            return undefined;
        }

        const currentBrunoDoc = await workspace.openTextDocument(
            Uri.file(bruFilePath)
        );

        const newBruContentSnapshot = currentBrunoDoc.getText();

        return await waitForTempJsFileToBeInSync(
            tempJsFilesRegistry,
            collection,
            newBruContentSnapshot,
            getCodeBlocks(
                parseBruFile(new TextDocumentHelper(newBruContentSnapshot))
                    .blocks
            ),
            bruFilePath,
            token,
            logger
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
        "Cancellation requested after starting to wait for temp js file to be in sync."
    );
}

function isTempJsFileInSync(
    tempJsFileFullContent: string,
    relevantBlocksFromBruFile: Block[]
) {
    const blocksFromBruFile = getCodeBlocks(relevantBlocksFromBruFile);

    return blocksFromBruFile.every(({ name, content: bruFileBlockContent }) => {
        const jsFileBlock = getTempJsFileBlockContent(
            tempJsFileFullContent,
            name as RequestFileBlockName
        );

        if (!jsFileBlock) {
            return false;
        }

        return jsFileBlock.content == bruFileBlockContent;
    });
}

async function createTemporaryJsFileIfNotAlreadyExisting(
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    collection: Collection,
    bruFileContent: string,
    logger?: OutputChannelLogger
) {
    const isTempJsFileRegistered = tempJsFilesRegistry
        .getCollectionsWithRegisteredJsFiles()
        .some(
            (registered) =>
                normalizeDirectoryPath(registered) ==
                normalizeDirectoryPath(collection.getRootDirectory())
        );

    if (
        !isTempJsFileRegistered ||
        !(await checkIfPathExistsAsync(
            getTemporaryJsFileName(collection.getRootDirectory())
        ))
    ) {
        await createTemporaryJsFile(
            collection.getRootDirectory(),
            tempJsFilesRegistry,
            bruFileContent,
            logger
        );
    }
}
