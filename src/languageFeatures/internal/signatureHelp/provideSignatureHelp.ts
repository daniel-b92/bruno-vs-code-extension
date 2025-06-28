import { commands, languages, SignatureHelp } from "vscode";
import {
    CollectionItemProvider,
    mapRange,
    OutputChannelLogger,
    parseBruFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../shared";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { getCodeBlocks } from "../shared/codeBlocksUtils/getCodeBlocks";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { TemporaryJsFilesRegistry } from "../shared/temporaryJsFilesRegistry";
import { waitForTempJsFileToBeInSync } from "../shared/codeBlocksUtils/waitForTempJsFileToBeInSync";

export function provideSignatureHelp(
    collectionItemProvider: CollectionItemProvider,
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    logger?: OutputChannelLogger
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
                    const temporaryJsDoc = await waitForTempJsFileToBeInSync(
                        tempJsFilesRegistry,
                        collection,
                        document.getText(),
                        blocksToCheck,
                        document.fileName,
                        logger
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
