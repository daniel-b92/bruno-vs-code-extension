import { commands, Hover, languages } from "vscode";
import {
    Block,
    CodeBlock,
    isBlockCodeBlock,
    parseBruFile,
    RequestFileBlockName,
    TextDocumentHelper,
    getFirstParameterForInbuiltFunctionIfStringLiteral,
    getInbuiltFunctionType,
    getInbuiltFunctionIdentifiers,
} from "@global_shared";
import { TypedCollection, TypedCollectionItemProvider } from "@shared";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { mapToRangeWithinBruFile } from "../shared/codeBlocksUtils/mapToRangeWithinBruFile";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { LanguageFeatureRequest } from "../../shared/interfaces";
import { mapToEnvVarNameParams } from "../shared/codeBlocksUtils/mapToGetEnvVarNameParams";
import { getHoverForEnvVariable } from "../../shared/environmentVariables/getHoverForEnvVariable";
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
                return getHoverForCodeBlocks(queue, {
                    file: { collection, allBlocks, blockContainingPosition },
                    hoverRequest: { document, position, token },
                    logger,
                });
            }

            return undefined;
        },
    });
}

async function getHoverForCodeBlocks(
    tempJsUpdateQueue: TempJsFileUpdateQueue,
    params: ProviderParamsForCodeBlock,
) {
    const {
        file: { blockContainingPosition, allBlocks, collection },
        hoverRequest: { token, position },
        logger,
    } = params;

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const envVariableResult = getEnvVariableNameFromCodeBlock(params);

    if (envVariableResult) {
        const { inbuiltFunction, variableName } = envVariableResult;

        return getHoverForEnvVariable({
            requestData: {
                collection,
                functionType: getInbuiltFunctionType(inbuiltFunction),
                variableName,
                requestPosition: position,
                token,
            },
            bruFileSpecificData: {
                blockContainingPosition,
                allBlocks,
            },
            logger,
        });
    }

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

function getEnvVariableNameFromCodeBlock({
    file: { collection, blockContainingPosition },
    hoverRequest,
    logger,
}: ProviderParamsForCodeBlock) {
    const { token } = hoverRequest;

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    return getFirstParameterForInbuiltFunctionIfStringLiteral(
        mapToEnvVarNameParams(
            {
                file: {
                    collection,
                    blockContainingPosition,
                },
                request: hoverRequest,
                logger,
            },
            getInbuiltFunctionIdentifiers(),
        ),
    );
}

function addLogEntryForCancellation(logger?: OutputChannelLogger) {
    logger?.debug(`Cancellation requested for hover provider.`);
}
