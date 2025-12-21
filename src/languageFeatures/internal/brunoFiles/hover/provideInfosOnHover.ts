import { commands, Hover, languages } from "vscode";
import {
    Block,
    CodeBlock,
    Collection,
    CollectionItemProvider,
    isBlockCodeBlock,
    mapFromVsCodePosition,
    mapToVsCodeRange,
    OutputChannelLogger,
    parseBruFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../../shared";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { mapToRangeWithinBruFile } from "../shared/codeBlocksUtils/mapToRangeWithinBruFile";
import { waitForTempJsFileToBeInSyncWithBruFile } from "../shared/codeBlocksUtils/waitForTempJsFileToBeInSyncWithBruFile";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { getNonCodeBlocksWithoutVariableSupport } from "../shared/nonCodeBlockUtils/getNonCodeBlocksWithoutVariableSupport";
import { LanguageFeatureRequest } from "../../shared/interfaces";
import { getVariableNameForPositionInNonCodeBlock } from "../shared/nonCodeBlockUtils/getVariableNameForPositionInNonCodeBlock";
import { mapToEnvVarNameParams } from "../shared/codeBlocksUtils/mapToGetEnvVarNameParams";
import { getHoverForEnvironmentVariable } from "../../shared/environmentVariables/getHoverForEnvironmentVariable";
import { getStringLiteralParameterForInbuiltFunction } from "../../shared/environmentVariables/getStringLiteralParameterForEnvVarInbuiltFunction";
import { getInbuiltFunctionsForEnvironmentVariables } from "../../shared/environmentVariables/getInbuiltFunctionsForEnvironmentVariables";

interface ProviderParamsForNonCodeBlock {
    file: {
        collection: Collection;
        blockContainingPosition: Block;
    };
    hoverRequest: LanguageFeatureRequest;
    logger?: OutputChannelLogger;
}

interface ProviderParamsForCodeBlock extends ProviderParamsForNonCodeBlock {
    file: {
        collection: Collection;
        blockContainingPosition: CodeBlock;
    };
}

export function provideInfosOnHover(
    queue: TempJsFileUpdateQueue,
    collectionItemProvider: CollectionItemProvider,
    logger?: OutputChannelLogger,
) {
    return languages.registerHoverProvider(getRequestFileDocumentSelector(), {
        async provideHover(document, position, token) {
            const collection =
                collectionItemProvider.getAncestorCollectionForPath(
                    document.fileName,
                );

            if (!collection) {
                return null;
            }

            const { blocks: parsedBlocks } = parseBruFile(
                new TextDocumentHelper(document.getText()),
            );

            const blockContainingPosition = parsedBlocks.find(
                ({ contentRange }) =>
                    mapToVsCodeRange(contentRange).contains(position),
            );

            if (!blockContainingPosition) {
                return undefined;
            }

            if (isBlockCodeBlock(blockContainingPosition)) {
                return getHoverForCodeBlocks(queue, {
                    file: { collection, blockContainingPosition },
                    hoverRequest: { document, position, token },
                    logger,
                });
            }

            return getHoverForNonCodeBlocks({
                file: { collection, blockContainingPosition },
                hoverRequest: { document, position, token },
                logger,
            });
        },
    });
}

function getHoverForNonCodeBlocks({
    file: {
        collection,
        blockContainingPosition: { name: blockName },
    },
    hoverRequest,
    logger,
}: ProviderParamsForNonCodeBlock) {
    const { token } = hoverRequest;
    if (
        (getNonCodeBlocksWithoutVariableSupport() as string[]).includes(
            blockName,
        )
    ) {
        return undefined;
    }

    const variableName = getVariableNameForPositionInNonCodeBlock(hoverRequest);

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    return variableName
        ? getHoverForEnvironmentVariable(
              collection,
              variableName,
              token,
              logger,
          )
        : undefined;
}

async function getHoverForCodeBlocks(
    tempJsUpdateQueue: TempJsFileUpdateQueue,
    params: ProviderParamsForCodeBlock,
) {
    const {
        file: { blockContainingPosition, collection },
        hoverRequest: { document, position, token },
        logger,
    } = params;

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const envVariableResult = getEnvVariableNameFromCodeBlock(params);

    if (envVariableResult) {
        return getHoverForEnvironmentVariable(
            collection,
            envVariableResult.variableName,
            token,
            logger,
        );
    }

    const temporaryJsDoc = await waitForTempJsFileToBeInSyncWithBruFile(
        tempJsUpdateQueue,
        {
            collection,
            bruFileContentSnapshot: document.getText(),
            bruFilePath: document.fileName,
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

    return getStringLiteralParameterForInbuiltFunction(
        mapToEnvVarNameParams(
            {
                file: {
                    collection,
                    blockContainingPosition,
                },
                request: hoverRequest,
                logger,
            },
            [
                getInbuiltFunctionsForEnvironmentVariables()
                    .getEnvironmentVariable,
            ],
        ),
    );
}

function addLogEntryForCancellation(logger?: OutputChannelLogger) {
    logger?.debug(`Cancellation requested for hover provider.`);
}
