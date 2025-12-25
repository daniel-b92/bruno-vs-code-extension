import {
    languages,
    commands,
    CompletionList,
    CompletionItem,
    TextEdit,
    Range as VsCodeRange,
    Position as VsCodePosition,
} from "vscode";
import {
    CollectionItemProvider,
    parseBruFile,
    TextDocumentHelper,
    mapToVsCodeRange,
    RequestFileBlockName,
    OutputChannelLogger,
    mapFromVsCodePosition,
    Block,
    Collection,
    getConfiguredTestEnvironment,
    getCodeBlocks,
    VariableReferenceType,
    getFirstParameterForInbuiltFunctionIfStringLiteral,
    getInbuiltFunctionIdentifiers,
    getInbuiltFunctionType,
} from "../../../../shared";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { mapToRangeWithinBruFile } from "../shared/codeBlocksUtils/mapToRangeWithinBruFile";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import {
    TempJsSyncRequestForBruFile,
    waitForTempJsFileToBeInSyncWithBruFile,
} from "../shared/codeBlocksUtils/waitForTempJsFileToBeInSyncWithBruFile";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import { mapToEnvVarNameParams } from "../shared/codeBlocksUtils/mapToGetEnvVarNameParams";
import {
    EnvVariableNameMatchingMode,
    getMatchingDefinitionsFromEnvFiles,
} from "../../shared/environmentVariables/getMatchingDefinitionsFromEnvFiles";
import { LanguageFeatureRequest } from "../../shared/interfaces";
import { mapEnvVariablesToCompletions } from "../../shared/environmentVariables/mapEnvVariablesToCompletions";

type CompletionItemRange =
    | VsCodeRange
    | {
          inserting: VsCodeRange;
          replacing: VsCodeRange;
      }
    | undefined;

export function provideTsLangCompletionItems(
    queue: TempJsFileUpdateQueue,
    collectionItemProvider: CollectionItemProvider,
    logger?: OutputChannelLogger,
) {
    return languages.registerCompletionItemProvider(
        getRequestFileDocumentSelector(),
        {
            async provideCompletionItems(document, position, token) {
                const collection =
                    collectionItemProvider.getAncestorCollectionForPath(
                        document.fileName,
                    );

                if (!collection) {
                    return [];
                }

                const { blocks: allBlocks } = parseBruFile(
                    new TextDocumentHelper(document.getText()),
                );

                const blocksToCheck = getCodeBlocks(allBlocks);

                const blockContainingPosition = blocksToCheck.find(
                    ({ contentRange }) =>
                        mapToVsCodeRange(contentRange).contains(position),
                );

                if (!blockContainingPosition) {
                    return undefined;
                }

                if (token.isCancellationRequested) {
                    addLogEntryForCancellation(logger);
                    return undefined;
                }

                const envVariableResult =
                    getFirstParameterForInbuiltFunctionIfStringLiteral(
                        mapToEnvVarNameParams(
                            {
                                file: {
                                    collection,
                                    blockContainingPosition,
                                },
                                request: { document, position, token },
                                logger,
                            },
                            getInbuiltFunctionIdentifiers(),
                        ),
                    );

                if (envVariableResult) {
                    const { inbuiltFunction, variableName } = envVariableResult;

                    return getResultsForEnvironmentVariable(
                        variableName,
                        {
                            collection,
                            functionType:
                                getInbuiltFunctionType(inbuiltFunction),
                            blockContainingPosition,
                            allBlocks,
                        },
                        { document, position, token },
                        logger,
                    );
                }

                return getResultsViaTempJsFile(
                    queue,
                    {
                        collection,
                        bruFileContentSnapshot: document.getText(),
                        bruFilePath: document.fileName,
                        token,
                    },
                    blockContainingPosition,
                    position,
                    logger,
                );
            },
        },
        ".",
        "/",
        '"',
        "'",
        "`",
    );
}

function getResultsForEnvironmentVariable(
    variableName: string,
    additionalData: {
        collection: Collection;
        functionType: VariableReferenceType;
        blockContainingPosition: Block;
        allBlocks: Block[];
    },
    { position, token }: LanguageFeatureRequest,
    logger?: OutputChannelLogger,
) {
    const { collection, functionType, allBlocks, blockContainingPosition } =
        additionalData;

    const matchingStaticEnvVariableDefinitions =
        getMatchingDefinitionsFromEnvFiles(
            collection,
            variableName,
            EnvVariableNameMatchingMode.Ignore,
            getConfiguredTestEnvironment(),
        );

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return [];
    }

    return mapEnvVariablesToCompletions(
        matchingStaticEnvVariableDefinitions.map(
            ({ file, matchingVariables, isConfiguredEnv }) => ({
                environmentFile: file,
                matchingVariableKeys: matchingVariables.map(({ key }) => key),
                isConfiguredEnv,
            }),
        ),
        {
            requestData: {
                collection,
                functionType,
                requestPosition: position,
                variableName,
                token,
            },
            bruFileSpecificData: { allBlocks, blockContainingPosition },
            logger,
        },
    );
}

async function getResultsViaTempJsFile(
    queue: TempJsFileUpdateQueue,
    tempJsRequest: TempJsSyncRequestForBruFile,
    blockInBruFile: Block,
    position: VsCodePosition,
    logger?: OutputChannelLogger,
) {
    const { token } = tempJsRequest;
    const temporaryJsDoc = await waitForTempJsFileToBeInSyncWithBruFile(
        queue,
        tempJsRequest,
        logger,
    );

    if (!temporaryJsDoc) {
        return undefined;
    }

    if (token != undefined && token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const startTimeForFetchingCompletions = performance.now();

    const resultFromJsFile = await commands.executeCommand<CompletionList>(
        "vscode.executeCompletionItemProvider",
        temporaryJsDoc.uri,
        getPositionWithinTempJsFile(
            temporaryJsDoc.getText(),
            blockInBruFile.name as RequestFileBlockName,
            mapFromVsCodePosition(
                position.translate(-blockInBruFile.contentRange.start.line),
            ),
        ),
    );

    logger?.trace(
        `Fetching completion items from temp JS file duration: ${Math.round(
            performance.now() - startTimeForFetchingCompletions,
        )} ms`,
    );

    if (token != undefined && token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const startTimeForMappingCompletions = performance.now();

    const currentTempJsContent = temporaryJsDoc.getText();

    const knownRangeMappings: {
        rangeInTempJsFile: VsCodeRange;
        rangeInBruFile: VsCodeRange;
    }[] = [];

    const result = new CompletionList<CompletionItem>(
        resultFromJsFile.items
            .map((item) =>
                getMappedItem(
                    item,
                    blockInBruFile,
                    currentTempJsContent,
                    knownRangeMappings,
                    logger,
                ),
            )
            .filter((mappedItem) => mappedItem != undefined),
        resultFromJsFile.isIncomplete,
    );

    logger?.trace(
        `Mapping completion items from temp JS file to bru file duration: ${Math.round(
            performance.now() - startTimeForMappingCompletions,
        )} ms`,
    );

    if (result.items.length < resultFromJsFile.items.length) {
        logger?.debug(
            `Only managed to map ${result.items.length} / ${resultFromJsFile.items.length} completion items from temp JS file.`,
        );
    }

    return result;
}

/**
 * Checks if all range related fields can be mapped and if not, undefined is returned. Otherwise, the mapped item is returned.
 */
function getMappedItem(
    item: CompletionItem,
    blockInBruFile: Block,
    currentTempJsContent: string,
    knownRangeMappings: {
        rangeInTempJsFile: VsCodeRange;
        rangeInBruFile: VsCodeRange;
    }[],
    logger?: OutputChannelLogger,
): CompletionItem | undefined {
    const { range: mappedRange, couldBeMapped: couldRangeBeMapped } =
        getMappedItemRange(
            item.range,
            blockInBruFile,
            currentTempJsContent,
            knownRangeMappings,
            logger,
        );

    if (!couldRangeBeMapped) {
        return undefined;
    }

    const { textEdit: mappedTextEdit, couldBeMapped: couldTextEditBeMapped } =
        getMappedItemTextEdit(
            item.textEdit,
            blockInBruFile,
            currentTempJsContent,
            knownRangeMappings,
            logger,
        );

    if (!couldTextEditBeMapped) {
        return undefined;
    }
    return {
        ...item,
        /* Without unsetting the command field, selecting an exported function causes the `require` statement 
                        to be inserted in the temp js file. */
        command: undefined,
        range: mappedRange,
        textEdit: mappedTextEdit,
    };
}

function getMappedItemRange(
    itemRange: CompletionItemRange,
    blockInBruFile: Block,
    currentTempJsContent: string,
    knownRangeMappings: {
        rangeInTempJsFile: VsCodeRange;
        rangeInBruFile: VsCodeRange;
    }[],
    logger?: OutputChannelLogger,
): { range: CompletionItemRange; couldBeMapped: boolean } {
    if (itemRange == undefined) {
        return { range: undefined, couldBeMapped: true };
    }

    if (itemRange instanceof VsCodeRange) {
        return {
            range: mapTempJsRangeToBruFileRange(
                blockInBruFile,
                currentTempJsContent,
                itemRange,
                knownRangeMappings,
                logger,
            ),
            couldBeMapped: true,
        };
    }

    const mappedInsertion = mapTempJsRangeToBruFileRange(
        blockInBruFile,
        currentTempJsContent,
        itemRange.inserting,
        knownRangeMappings,
        logger,
    );

    const mappedReplacement = mapTempJsRangeToBruFileRange(
        blockInBruFile,
        currentTempJsContent,
        itemRange.replacing,
        knownRangeMappings,
        logger,
    );

    if (!mappedInsertion || !mappedReplacement) {
        return { range: undefined, couldBeMapped: false };
    }

    return {
        range: {
            inserting: mappedInsertion,
            replacing: mappedReplacement,
        },
        couldBeMapped: true,
    };
}

function getMappedItemTextEdit(
    itemTextEdit: TextEdit | undefined,
    blockInBruFile: Block,
    currentTempJsContent: string,
    knownRangeMappings: {
        rangeInTempJsFile: VsCodeRange;
        rangeInBruFile: VsCodeRange;
    }[],
    logger?: OutputChannelLogger,
): { textEdit: TextEdit | undefined; couldBeMapped: boolean } {
    if (!itemTextEdit) {
        return { textEdit: undefined, couldBeMapped: true };
    }

    const mappedTextEditRange = mapTempJsRangeToBruFileRange(
        blockInBruFile,
        currentTempJsContent,
        itemTextEdit.range,
        knownRangeMappings,
        logger,
    );

    if (!mappedTextEditRange) {
        return { textEdit: undefined, couldBeMapped: false };
    }

    return {
        textEdit: new TextEdit(mappedTextEditRange, itemTextEdit.newText),
        couldBeMapped: true,
    };
}

function mapTempJsRangeToBruFileRange(
    blockInBruFile: Block,
    fullJsFileContent: string,
    rangeInJsFile: VsCodeRange,
    knownRangeMappings: {
        rangeInTempJsFile: VsCodeRange;
        rangeInBruFile: VsCodeRange | undefined;
    }[],
    logger?: OutputChannelLogger,
) {
    const knownMapping = knownRangeMappings.find(
        ({ rangeInTempJsFile: rangeWithKnownMapping }) =>
            rangeInJsFile.isEqual(rangeWithKnownMapping),
    );

    if (knownMapping) {
        return knownMapping.rangeInBruFile;
    }

    const mappedRange = mapToRangeWithinBruFile(
        blockInBruFile,
        fullJsFileContent,
        rangeInJsFile,
        logger,
    );

    knownRangeMappings.push({
        rangeInTempJsFile: rangeInJsFile,
        rangeInBruFile: mappedRange,
    });

    return mappedRange;
}

function addLogEntryForCancellation(logger?: OutputChannelLogger) {
    logger?.debug(
        `Cancellation requested for completion provider for code blocks.`,
    );
}
