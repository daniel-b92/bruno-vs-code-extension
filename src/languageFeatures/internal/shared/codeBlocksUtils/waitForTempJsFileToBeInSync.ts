import { Disposable, TextDocument, Uri, workspace } from "vscode";
import {
    Block,
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
import { existsSync } from "fs";
import { getCodeBlocks } from "./getCodeBlocks";
import { getTempJsFileBlockContent } from "./getTempJsFileBlockContent";

export async function waitForTempJsFileToBeInSync(
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    collection: Collection,
    bruFileContentSnapshot: string,
    bruFileCodeBlocksSnapshot: Block[],
    bruFilePath: string,
    logger?: OutputChannelLogger
): Promise<TextDocument | undefined> {
    await createTemporaryJsFileIfNotAlreadyExisting(
        tempJsFilesRegistry,
        collection,
        bruFileContentSnapshot
    );

    const virtualJsFileUri = Uri.file(
        getTemporaryJsFileName(collection.getRootDirectory())
    );

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
    const timeout = setTimeout(
        () =>
            createTemporaryJsFile(
                collection.getRootDirectory(),
                tempJsFilesRegistry,
                bruFileContentSnapshot
            ),
        10_000
    );

    const { document: currentJsDoc, shouldRetry } = await new Promise<{
        document?: TextDocument;
        shouldRetry?: boolean;
    }>((resolve) => {
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
                    logger?.debug(`Temp JS file in sync after waiting.`);
                    timeout.close();
                    resolve({ document: e.document });
                }
            })
        );

        // If the bruno file is modified or deleted in the meantime, the request will be outdated, so it can be canceled.
        toDispose.push(
            workspace.onDidChangeTextDocument((e) => {
                if (e.document.uri.toString() == bruFilePath.toString()) {
                    logger?.debug(
                        `Aborting waiting for temp Js file to be in sync because bru file has been modified.`
                    );
                    timeout.close();
                    resolve({ shouldRetry: false });
                }
            }),
            workspace.onDidDeleteFiles((e) => {
                if (e.files.some(({ fsPath }) => fsPath == bruFilePath)) {
                    logger?.debug(
                        `Aborting waiting for temp Js file to be in sync because bru file has been deleted.`
                    );
                    timeout.close();
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
                    resolve({ shouldRetry: true });
                }
            })
        );
    });

    toDispose.forEach((disposable) => disposable.dispose());

    if (!currentJsDoc && shouldRetry) {
        const currentBrunoDoc = await workspace.openTextDocument(
            Uri.file(bruFilePath)
        );

        return await waitForTempJsFileToBeInSync(
            tempJsFilesRegistry,
            collection,
            currentBrunoDoc.getText(),
            getCodeBlocks(
                parseBruFile(new TextDocumentHelper(currentBrunoDoc.getText()))
                    .blocks
            ),
            bruFilePath
        );
    } else {
        return currentJsDoc;
    }
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
    bruFileContent: string
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
        !existsSync(getTemporaryJsFileName(collection.getRootDirectory()))
    ) {
        await createTemporaryJsFile(
            collection.getRootDirectory(),
            tempJsFilesRegistry,
            bruFileContent
        );
    }
}
