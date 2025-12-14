import {
    languages,
    commands,
    CompletionList,
    CompletionItem,
    TextEdit,
    Range as VsCodeRange,
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
} from "../../../../shared";
import { getCodeBlocks } from "../shared/codeBlocksUtils/getCodeBlocks";
import { getPositionWithinTempJsFile } from "../shared/codeBlocksUtils/getPositionWithinTempJsFile";
import { mapToRangeWithinBruFile } from "../shared/codeBlocksUtils/mapToRangeWithinBruFile";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { waitForTempJsFileToBeInSyncWithBruFile } from "../shared/codeBlocksUtils/waitForTempJsFileToBeInSyncWithBruFile";
import { TempJsFileUpdateQueue } from "../../shared/temporaryJsFilesUpdates/external/tempJsFileUpdateQueue";

type CompletionItemRange =
    | VsCodeRange
    | {
          inserting: VsCodeRange;
          replacing: VsCodeRange;
      }
    | undefined;

export function provideTsLanguageCompletionItems(
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

                const blocksToCheck = getCodeBlocks(
                    parseBruFile(new TextDocumentHelper(document.getText()))
                        .blocks,
                );

                const blockInBruFile = blocksToCheck.find(({ contentRange }) =>
                    mapToVsCodeRange(contentRange).contains(position),
                );

                if (!blockInBruFile) {
                    return undefined;
                }

                if (token.isCancellationRequested) {
                    logger?.debug(
                        `Cancellation requested for completion provider for code blocks.`,
                    );
                    return undefined;
                }

                const temporaryJsDoc =
                    await waitForTempJsFileToBeInSyncWithBruFile(
                        queue,
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
                    logger?.debug(
                        `Cancellation requested for completion provider for code blocks.`,
                    );
                    return undefined;
                }

                const startTimeForFetchingCompletions = performance.now();

                const resultFromJsFile =
                    await commands.executeCommand<CompletionList>(
                        "vscode.executeCompletionItemProvider",
                        temporaryJsDoc.uri,
                        getPositionWithinTempJsFile(
                            temporaryJsDoc.getText(),
                            blockInBruFile.name as RequestFileBlockName,
                            mapFromVsCodePosition(
                                position.translate(
                                    -blockInBruFile.contentRange.start.line,
                                ),
                            ),
                        ),
                    );

                logger?.trace(
                    `Fetching completion items from temp JS file duration: ${Math.round(
                        performance.now() - startTimeForFetchingCompletions,
                    )} ms`,
                );

                if (token.isCancellationRequested) {
                    logger?.debug(
                        `Cancellation requested for completion provider for code blocks while fetching completons from temp JS file.`,
                    );
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
            },
        },
        ".",
        "/",
    );
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
