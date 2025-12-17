import {
    CancellationToken,
    commands,
    Hover,
    languages,
    MarkdownString,
} from "vscode";
import {
    Block,
    Collection,
    CollectionItemProvider,
    getConfiguredTestEnvironment,
    getExtensionForBrunoFiles,
    mapFromVsCodePosition,
    mapToVsCodeRange,
    OutputChannelLogger,
    parseBruFile,
    parseCodeBlock,
    RequestFileBlockName,
    shouldBeCodeBlock,
    TextDocumentHelper,
} from "../../../../shared";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { mapToRangeWithinBruFile } from "../shared/codeBlocksUtils/mapToRangeWithinBruFile";
import { waitForTempJsFileToBeInSyncWithBruFile } from "../shared/codeBlocksUtils/waitForTempJsFileToBeInSyncWithBruFile";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { basename } from "path";
import { getNonCodeBlocksWithoutVariableSupport } from "../shared/nonCodeBlockUtils/getNonCodeBlocksWithoutVariableSupport";
import { LanguageFeatureRequest } from "../shared/interfaces";
import { getVariableNameForPositionInNonCodeBlock } from "../shared/nonCodeBlockUtils/getVariableNameForPositionInNonCodeBlock";
import {
    EnvVariableNameMatchingMode,
    getMatchingEnvironmentVariableDefinitions,
} from "../shared/getMatchingEnvironmentVariableDefinitions";
import { SyntaxKind } from "typescript";
import { getStringLiteralParameterForGetEnvVarInbuiltFunction } from "../shared/codeBlocksUtils/getStringLiteralParameterForGetEnvVarInbuiltFunction";

interface ProviderParams {
    file: {
        collection: Collection;
        blockContainingPosition: Block;
    };
    hoverRequest: LanguageFeatureRequest;
    logger?: OutputChannelLogger;
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

            if (shouldBeCodeBlock(blockContainingPosition.name)) {
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
}: ProviderParams) {
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
        ? getHoverForVariable(collection, variableName, token, logger)
        : undefined;
}

async function getHoverForCodeBlocks(
    tempJsUpdateQueue: TempJsFileUpdateQueue,
    params: ProviderParams,
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

    const envVariableNameForRequest = getEnvVariableNameForRequest(params);

    if (envVariableNameForRequest) {
        return getHoverForVariable(
            collection,
            envVariableNameForRequest,
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

function getEnvVariableNameForRequest({
    file: {
        collection,
        blockContainingPosition: { contentRange },
    },
    hoverRequest,
    logger,
}: ProviderParams) {
    const { document, token } = hoverRequest;
    const firstContentLine = contentRange.start.line;

    const parsedCodeBlock = parseCodeBlock(
        new TextDocumentHelper(document.getText()),
        firstContentLine,
        SyntaxKind.Block,
    );

    if (!parsedCodeBlock) {
        return undefined;
    }
    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const paramName = getStringLiteralParameterForGetEnvVarInbuiltFunction({
        file: {
            collection,
            blockContainingPosition: parsedCodeBlock,
        },
        request: hoverRequest,
        logger,
    });

    return paramName?.text.match(/\w+/)?.[0];
}

function getHoverForVariable(
    collection: Collection,
    variableName: string,
    token: CancellationToken,
    logger?: OutputChannelLogger,
) {
    const tableHeader = `| value | environment | configured |
| :--------------- | :----------------: | :----------------: | \n`;

    const configuredEnvironmentName = getConfiguredTestEnvironment();
    const matchingVariableDefinitions =
        getMatchingEnvironmentVariableDefinitions(
            collection,
            variableName,
            EnvVariableNameMatchingMode.Exact,
            configuredEnvironmentName,
        );

    if (matchingVariableDefinitions.length == 0) {
        return undefined;
    }

    if (token.isCancellationRequested) {
        logger?.debug(`Cancellation requested for hover provider.`);
        return undefined;
    }

    return new Hover(
        new MarkdownString(
            tableHeader.concat(
                matchingVariableDefinitions
                    .map(({ file, matchingVariables, isConfiguredEnv }) => {
                        const environmentName = basename(
                            file,
                            getExtensionForBrunoFiles(),
                        );

                        return matchingVariables
                            .map(
                                ({ value }) =>
                                    `| ${value} | ${environmentName}  | ${isConfiguredEnv ? "&#x2611;" : "no"} |`,
                            )
                            .join("\n");
                    })
                    .join("\n"),
            ),
        ),
    );
}

function addLogEntryForCancellation(logger?: OutputChannelLogger) {
    logger?.debug(`Cancellation requested for hover provider.`);
}
