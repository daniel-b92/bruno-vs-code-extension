import { commands, languages, SignatureHelp } from "vscode";
import {
    CollectionItemProvider,
    mapRange,
    parseBruFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../shared";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { getCodeBlocks } from "../shared/codeBlocksUtils/getCodeBlocks";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { TemporaryJsFileSyncQueue } from "../shared/temporaryJsFileSyncQueue";

export function provideSignatureHelp(
    collectionItemProvider: CollectionItemProvider,
    tempJsFileSyncQueue: TemporaryJsFileSyncQueue
) {
    return languages.registerSignatureHelpProvider(
        getRequestFileDocumentSelector(),
        {
            async provideSignatureHelp(document, position) {
                const collection =
                    collectionItemProvider.getAncestorCollectionForPath(
                        document.fileName
                    );

                if (!collection) {
                    return null;
                }

                const blocksToCheck = getCodeBlocks(
                    parseBruFile(new TextDocumentHelper(document.getText()))
                        .blocks
                );

                const blockInBruFile = blocksToCheck.find(({ contentRange }) =>
                    mapRange(contentRange).contains(position)
                );

                if (blockInBruFile) {
                    const temporaryJsDoc = await tempJsFileSyncQueue.addToQueue(
                        {
                            collection,
                            bruFileContent: document.getText(),
                            bruFilePath: document.fileName,
                            bruFileCodeBlocks: blocksToCheck,
                        }
                    );

                    if (!temporaryJsDoc) {
                        return undefined;
                    }

                    return await commands.executeCommand<SignatureHelp>(
                        "vscode.executeSignatureHelpProvider",
                        temporaryJsDoc.uri,
                        getPositionWithinTempJsFile(
                            temporaryJsDoc.getText(),
                            blockInBruFile.name as RequestFileBlockName,
                            position.translate(
                                -blockInBruFile.contentRange.start.line
                            )
                        )
                    );
                }
            },
        }
    );
}
