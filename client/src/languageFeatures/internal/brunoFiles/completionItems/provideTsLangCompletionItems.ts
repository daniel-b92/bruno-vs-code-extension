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
    OutputChannelLogger,
    mapFromVsCodePosition,
    TypedCollectionItemProvider,
} from "@shared";
import {
    RequestFileBlockName,
    Block,
    getFirstParameterForInbuiltFunctionIfStringLiteral,
    getInbuiltFunctionIdentifiers,
} from "@global_shared";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { mapToRangeWithinBruFile } from "../shared/codeBlocksUtils/mapToRangeWithinBruFile";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";
import {
    TempJsSyncRequest,
    waitForTempJsFileToBeInSync,
} from "../../shared/temporaryJsFilesUpdates/external/waitForTempJsFileToBeInSync";
import { mapToEnvVarNameParams } from "../shared/codeBlocksUtils/mapToGetEnvVarNameParams";
import { getCodeBlockContainingPosition } from "../shared/codeBlocksUtils/getCodeBlockContainingPosition";

type CompletionItemRange =
    | VsCodeRange
    | {
          inserting: VsCodeRange;
          replacing: VsCodeRange;
      }
    | undefined;

export function provideTsLangCompletionItems(
    queue: TempJsFileUpdateQueue,
    collectionItemProvider: TypedCollectionItemProvider,
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

                const blockContainingPosition = getCodeBlockContainingPosition(
                    document.getText(),
                    position,
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
                    // Completions for environment variables are already provided via the language server.
                    // Since they are also provided in `.js` files, avoid fetching completions via temp js file in this case.
                    return;
                }

                return getResultsViaTempJsFile(
                    queue,
                    {
                        collection,
                        bruFileContentSnapshot: document.getText(),
                        bruFilePath: document.fileName,
                        bruFileEol: document.eol,
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

async function getResultsViaTempJsFile(
    queue: TempJsFileUpdateQueue,
    tempJsRequest: TempJsSyncRequest,
    blockInBruFile: Block,
    position: VsCodePosition,
    logger?: OutputChannelLogger,
) {
    const { token } = tempJsRequest;
    const temporaryJsDoc = await waitForTempJsFileToBeInSync(
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
