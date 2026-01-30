import { commands, Hover, languages, MarkdownString } from "vscode";
import {
    Block,
    CodeBlock,
    getBlocksWithoutVariableSupport,
    isBlockCodeBlock,
    parseBruFile,
    RequestFileBlockName,
    TextDocumentHelper,
    getFirstParameterForInbuiltFunctionIfStringLiteral,
    VariableReferenceType,
    getInbuiltFunctionType,
    getDictionaryBlockArrayField,
    MetaBlockKey,
    getInbuiltFunctionIdentifiers,
} from "@global_shared";
import { getVariableNameForPositionInNonCodeBlock } from "@shared";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { mapToRangeWithinBruFile } from "../shared/codeBlocksUtils/mapToRangeWithinBruFile";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { LanguageFeatureRequest } from "../../shared/interfaces";
import { mapToEnvVarNameParams } from "../shared/codeBlocksUtils/mapToGetEnvVarNameParams";
import { getHoverForEnvVariable } from "../../shared/environmentVariables/getHoverForEnvVariable";
import {
    getLineBreak,
    mapFromVsCodePosition,
    mapToVsCodeRange,
    OutputChannelLogger,
    Collection,
    CollectionItemProvider,
} from "@shared";
import {
    getExistingRequestFileTags,
    TagOccurences,
} from "../shared/getExistingRequestFileTags";
import { basename } from "path";
import { waitForTempJsFileToBeInSync } from "../../shared/temporaryJsFilesUpdates/external/waitForTempJsFileToBeInSync";

interface ProviderParamsForNonCodeBlock {
    file: {
        collection: Collection;
        allBlocks: Block[];
        blockContainingPosition: Block;
    };
    hoverRequest: LanguageFeatureRequest;
    logger?: OutputChannelLogger;
}

interface ProviderParamsForCodeBlock extends ProviderParamsForNonCodeBlock {
    file: {
        collection: Collection;
        allBlocks: Block[];
        blockContainingPosition: CodeBlock;
    };
}

export function provideInfosOnHover(
    queue: TempJsFileUpdateQueue,
    itemProvider: CollectionItemProvider,
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

            const { blocks: allBlocks } = parseBruFile(
                new TextDocumentHelper(document.getText()),
            );

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

            return getHoverForNonCodeBlocks(itemProvider, {
                file: { collection, allBlocks, blockContainingPosition },
                hoverRequest: { document, position, token },
                logger,
            });
        },
    });
}

function getHoverForNonCodeBlocks(
    itemProvider: CollectionItemProvider,
    params: ProviderParamsForNonCodeBlock,
) {
    return (
        getHoverForTagsInMetaBlock(itemProvider, params) ??
        getHoverForVariablesInNonCodeBlocks(params)
    );
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

function getHoverForTagsInMetaBlock(
    itemProvider: CollectionItemProvider,
    {
        file: { collection, blockContainingPosition },
        hoverRequest,
        logger,
    }: ProviderParamsForNonCodeBlock,
) {
    const { document, position, token } = hoverRequest;

    if (blockContainingPosition.name != RequestFileBlockName.Meta) {
        return undefined;
    }

    const tagsField = getDictionaryBlockArrayField(
        blockContainingPosition,
        MetaBlockKey.Tags,
    );
    if (!tagsField || tagsField.values.length == 0) {
        return undefined;
    }

    const tagValueField = tagsField.values.find(({ range }) =>
        mapToVsCodeRange(range).contains(position),
    );

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }
    if (!tagValueField) {
        return undefined;
    }

    const tagOccurences = getExistingRequestFileTags(itemProvider, {
        collection,
        pathToIgnore: document.fileName,
    }).filter(({ tag }) => tag == tagValueField.content);

    if (tagOccurences.length < 1) {
        return new Hover("No other usages found.");
    }

    return getHoverForTagOccurences(document.fileName, tagOccurences[0]);
}

function getHoverForVariablesInNonCodeBlocks({
    file: { allBlocks, collection, blockContainingPosition },
    hoverRequest,
    logger,
}: ProviderParamsForNonCodeBlock) {
    const { position, token } = hoverRequest;

    if (
        (getBlocksWithoutVariableSupport() as string[]).includes(
            blockContainingPosition.name,
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
        ? getHoverForEnvVariable({
              requestData: {
                  collection,
                  variableName,
                  functionType: VariableReferenceType.Read, // In non-code blocks, variables can not be set.
                  requestPosition: position,
                  token,
              },
              bruFileSpecificData: { allBlocks, blockContainingPosition },
              logger,
          })
        : undefined;
}

function getHoverForTagOccurences(
    filePath: string,
    { pathsInOwnCollection, inOtherCollections }: TagOccurences,
) {
    const lineBreak = getLineBreak();
    const tableHeader = `| collection | usages |
| :--------------- | ----------------: | ${getLineBreak()}`;

    if (pathsInOwnCollection.length == 0 && inOtherCollections.length == 0) {
        return new Hover(new MarkdownString("No other usages found."));
    }

    const content = tableHeader
        .concat(
            pathsInOwnCollection.length > 0
                ? `| own | ${pathsInOwnCollection.filter((path) => path != filePath).length} other file(s) | ${lineBreak}`
                : "",
        )
        .concat(
            inOtherCollections.length > 0
                ? inOtherCollections
                      .map(
                          ({ collection, paths }) =>
                              `| ${basename(collection.getRootDirectory())} | ${paths.length} |`,
                      )
                      .join(lineBreak)
                : "",
        );

    return new Hover(new MarkdownString(content));
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
