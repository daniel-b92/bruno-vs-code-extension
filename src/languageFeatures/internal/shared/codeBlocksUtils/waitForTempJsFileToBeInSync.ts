import { Uri, workspace } from "vscode";
import {
    Block,
    Collection,
    getTemporaryJsFileName,
    normalizeDirectoryPath,
    RequestFileBlockName,
} from "../../../../shared";
import { TemporaryJsFilesRegistry } from "../temporaryJsFilesRegistry";
import { createTemporaryJsFile } from "./createTemporaryJsFile";
import { existsSync } from "fs";
import { getCodeBlocks } from "./getCodeBlocks";
import { getTempJsFileBlockContent } from "./getTempJsFileBlockContent";

export async function waitForTempJsFileToBeInSync(
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    collection: Collection,
    bruFileContent: string,
    bruFileCodeBlocks: Block[]
) {
    createTemporaryJsFileIfNotAlreadyExisting(
        tempJsFilesRegistry,
        collection,
        bruFileContent
    );

    const virtualJsFileUri = Uri.file(
        getTemporaryJsFileName(collection.getRootDirectory())
    );

    const temporaryJsDoc = await workspace.openTextDocument(virtualJsFileUri);

    // Sometimes it takes a short while until VS Code notices that the Javascript file has been modified externally
    if (!isTempJsFileInSync(temporaryJsDoc.getText(), bruFileCodeBlocks)) {
        await new Promise<void>((resolve) => {
            // ToDo: Find a way to dispose of the event listener after Promise has been fulfilled
            workspace.onDidChangeTextDocument((e) => {
                if (
                    e.document.uri.toString() == virtualJsFileUri.toString() &&
                    e.contentChanges.length > 0 &&
                    isTempJsFileInSync(
                        temporaryJsDoc.getText(),
                        bruFileCodeBlocks
                    )
                ) {
                    resolve();
                }
            });
        });
    }

    return temporaryJsDoc;
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

function createTemporaryJsFileIfNotAlreadyExisting(
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
        createTemporaryJsFile(
            collection.getRootDirectory(),
            tempJsFilesRegistry,
            bruFileContent
        );
    }
}
