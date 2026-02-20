import { commands, Hover, languages } from "vscode";
import {
    Block,
    CodeBlock,
    isBlockCodeBlock,
    parseBruFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "@global_shared";
import { TypedCollection, TypedCollectionItemProvider } from "@shared";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { mapToRangeWithinBruFile } from "../shared/codeBlocksUtils/mapToRangeWithinBruFile";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { LanguageFeatureRequest } from "../../shared/interfaces";
import {
    mapFromVsCodePosition,
    mapToVsCodeRange,
    OutputChannelLogger,
} from "@shared";
import { waitForTempJsFileToBeInSync } from "../../shared/temporaryJsFilesUpdates/external/waitForTempJsFileToBeInSync";

interface ProviderParamsForNonCodeBlock {
    file: {
        collection: TypedCollection;
        allBlocks: Block[];
        blockContainingPosition: Block;
    };
    hoverRequest: LanguageFeatureRequest;
    logger?: OutputChannelLogger;
}

interface ProviderParamsForCodeBlock extends ProviderParamsForNonCodeBlock {
    file: {
        collection: TypedCollection;
        allBlocks: Block[];
        blockContainingPosition: CodeBlock;
    };
}

export function provideInfosOnHover(
    queue: TempJsFileUpdateQueue,
    itemProvider: TypedCollectionItemProvider,
    logger?: OutputChannelLogger,
) {
    return languages.registerHoverProvider(getRequestFileDocumentSelector(), {
        async provideHover(document, position, token) {
            const collection = itemProvider.getAncestorCollectionForPath(
                document.fileName,
            );

            if (!collection) {
                return null;
            }

            const docHelper = new TextDocumentHelper(document.getText());
            const { blocks: allBlocks } = parseBruFile(docHelper);

            const blockContainingPosition = allBlocks.find(({ contentRange }) =>
                mapToVsCodeRange(contentRange).contains(position),
            );

            if (!blockContainingPosition) {
                return undefined;
            }

            if (isBlockCodeBlock(blockContainingPosition)) {
                return getHoverForCodeBlock(queue, {
                    file: { collection, allBlocks, blockContainingPosition },
                    hoverRequest: { document, position, token },
                    logger,
                });
            }

            return undefined;
        },
    });
}

async function getHoverForCodeBlock(
    tempJsUpdateQueue: TempJsFileUpdateQueue,
    params: ProviderParamsForCodeBlock,
) {
    return await getResultsViaTempJsFile(tempJsUpdateQueue, params);
}

async function getResultsViaTempJsFile(
    tempJsUpdateQueue: TempJsFileUpdateQueue,
    {
        file: { collection, blockContainingPosition },
        hoverRequest: { document, position, token },
        logger,
    }: ProviderParamsForCodeBlock,
) {
    const temporaryJsDoc = await waitForTempJsFileToBeInSync(
        tempJsUpdateQueue,
        {
            collection,
            bruFileContentSnapshot: document.getText(),
            bruFilePath: document.fileName,
            bruFileEol: document.eol,
            token,
        },
        logger,
    );

    if (!temporaryJsDoc) {
        return undefined;
    }

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const resultFromJsFile = await commands.executeCommand<Hover[]>(
        "vscode.executeHoverProvider",
        temporaryJsDoc.uri,
        getPositionWithinTempJsFile(
            temporaryJsDoc.getText(),
            blockContainingPosition.name as RequestFileBlockName,
            mapFromVsCodePosition(
                position.translate(
                    -blockContainingPosition.contentRange.start.line,
                ),
            ),
        ),
    );

    return resultFromJsFile.length == 0
        ? null
        : resultFromJsFile[0].range
          ? new Hover(
                resultFromJsFile[0].contents,
                mapToRangeWithinBruFile(
                    blockContainingPosition,
                    temporaryJsDoc.getText(),
                    resultFromJsFile[0].range,
                    logger,
                ),
            )
          : resultFromJsFile[0];
}

function addLogEntryForCancellation(logger?: OutputChannelLogger) {
    logger?.debug(`Cancellation requested for hover provider.`);
}
