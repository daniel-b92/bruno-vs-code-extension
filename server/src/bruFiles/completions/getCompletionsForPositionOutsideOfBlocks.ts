import { basename } from "path";
import {
    Block,
    BlockBracket,
    BrunoFileType,
    EnvironmentFileTopLevelField,
    getDefaultIndentationForDictionaryBlockFields,
    getActiveSimpleFieldFromDictionaryBlockIfExistsOnce,
    getExtensionForBrunoFiles,
    MetaBlockKey,
    RequestFileBlockName,
    LineBreakType,
    Position,
    Range,
    shouldBeArrayBlock,
    shouldBeCodeBlock,
    shouldBeDictionaryBlock,
    TextDocumentHelper,
} from "@global_shared";
import { LanguageFeatureBaseRequest, TypedCollection } from "../../shared";
import {
    CompletionItem,
    InsertTextFormat,
    TextEdit,
} from "vscode-languageserver";
import { MissingBlock } from "../shared/interfaces";
import { getMissingMandatoryBlocks } from "../shared/getMissingMandatoryBlocks";
import { getMissingOptionalBlocks } from "../shared/getMissingOptionalBlocks";
import { getDictionaryBlockSnippetInsertionContent } from "./dictionaryBlocks/generic/getDictionaryBlockSnippetInsertionContent";
import { getTextEditForDictionaryBlockSimpleValue } from "./dictionaryBlocks/generic/getTextEditForDictionaryBlockSimpleValue";

interface BlockData {
    blockName: string;
    mandatory: boolean;
}

export function getCompletionsForPositionOutsideOfBlocks(
    request: LanguageFeatureBaseRequest,
    fileType: BrunoFileType,
    allBlocks: Block[],
    collection: TypedCollection,
): CompletionItem[] | undefined {
    const { position, documentHelper, filePath } = request;

    if (fileType == BrunoFileType.EnvironmentFile) {
        const extendsValueCompletions = getCompletionsForExtendsFieldValue(
            position,
            documentHelper,
            filePath,
            collection,
        );

        if (extendsValueCompletions) {
            return extendsValueCompletions;
        }
    }

    const startLineData = parseBlockStartLine(position, documentHelper);

    if (
        !startLineData ||
        // Do not provide completions if the position is after the block opening bracket.
        (startLineData.openingBracketIndex &&
            startLineData.openingBracketIndex < position.character)
    ) {
        return undefined;
    }

    const { openingBracket, openingBracketIndex } = startLineData;
    const {
        missingBlocks: missingMandatoryBlocks,
        blocksThatCannotBeOptional,
    } = getMissingMandatoryBlocks(fileType, allBlocks);
    const missingOptionalBlocks = getMissingOptionalBlocks(
        fileType,
        allBlocks,
        blocksThatCannotBeOptional.map(({ name }) => name),
    );

    const allMissingBlocks = mapToBlockData(
        missingMandatoryBlocks.concat(missingOptionalBlocks),
    );
    const filteredItems = openingBracket
        ? filterOutNonMatchingBlockTypes(allMissingBlocks, openingBracket)
        : allMissingBlocks;

    const completionItems = mapToCompletionItems(request, {
        validBlocks: filteredItems,
        blocksRequiringAdditionalTextEdits: blocksThatCannotBeOptional
            .filter(
                ({ neededForMakingBlockValid }) =>
                    neededForMakingBlockValid != undefined,
            )
            .map(({ name, neededForMakingBlockValid }) => ({
                data: { blockName: name, mandatory: false },
                additionalTextEdits: neededForMakingBlockValid as TextEdit[],
            })),
        fileType,
        collection,
        requestType: getActiveSimpleFieldFromDictionaryBlockIfExistsOnce(
            allBlocks,
            RequestFileBlockName.Meta,
            MetaBlockKey.Type,
        )?.value,
        blockStartBracketPosition: openingBracketIndex
            ? new Position(position.line, openingBracketIndex)
            : undefined,
    });

    if (
        fileType != BrunoFileType.EnvironmentFile ||
        openingBracket ||
        documentAlreadyHasExtendsField(documentHelper)
    ) {
        return completionItems;
    }

    const extendsKeyCompletion = getExtendsKeyCompletionItem(
        documentHelper,
        position.line,
        filePath,
        collection,
    );

    return extendsKeyCompletion
        ? completionItems.concat(extendsKeyCompletion)
        : completionItems;
}

function documentAlreadyHasExtendsField(documentHelper: TextDocumentHelper) {
    const pattern = new RegExp(
        `^\\s*${EnvironmentFileTopLevelField.Extends}\\s*:`,
    );

    return documentHelper
        .getAllLines()
        .some(({ content }) => pattern.test(content));
}

function getExtendsKeyCompletionItem(
    documentHelper: TextDocumentHelper,
    lineIndex: number,
    filePath: string,
    collection: TypedCollection,
): CompletionItem | undefined {
    const fullLineRange = documentHelper.getRangeForLine(lineIndex);

    if (!fullLineRange) {
        return undefined;
    }

    const availableEnvironmentNames = getAvailableEnvironmentNamesForExtends(
        filePath,
        collection,
    );

    const valuePlaceholder =
        availableEnvironmentNames.length > 0
            ? `\${1|${availableEnvironmentNames.map(escapeSnippetChoiceOption).join(",")}|}`
            : "${0}";

    return {
        label: EnvironmentFileTopLevelField.Extends,
        textEdit: {
            newText: `${EnvironmentFileTopLevelField.Extends}: ${valuePlaceholder}`,
            range: fullLineRange,
        },
        insertTextFormat: InsertTextFormat.Snippet,
        sortText: `b_${EnvironmentFileTopLevelField.Extends}`,
        labelDetails: { description: "optional" },
    };
}

function escapeSnippetChoiceOption(option: string): string {
    return option.replace(/[\\,|]/g, (match) => `\\${match}`);
}

function getAvailableEnvironmentNamesForExtends(
    filePath: string,
    collection: TypedCollection,
): string[] {
    const ownEnvironmentName = basename(filePath, getExtensionForBrunoFiles());

    return collection
        .getEnvironments()
        .map(({ environmentName }) => environmentName)
        .filter((environmentName) => environmentName != ownEnvironmentName)
        .filter(
            (environmentName) =>
                !collection
                    .getEnvironmentInheritanceChain(environmentName)
                    .includes(ownEnvironmentName),
        );
}

function getCompletionsForExtendsFieldValue(
    position: Position,
    documentHelper: TextDocumentHelper,
    filePath: string,
    collection: TypedCollection,
): CompletionItem[] | undefined {
    const currentLineContent = documentHelper.getLineByIndex(position.line);
    const match = new RegExp(
        `^\\s*${EnvironmentFileTopLevelField.Extends}\\s*:\\s*`,
    ).exec(currentLineContent);

    if (!match || position.character < match[0].length) {
        return undefined;
    }

    return getAvailableEnvironmentNamesForExtends(filePath, collection).map(
        (environmentName) => ({
            label: environmentName,
            textEdit: getTextEditForDictionaryBlockSimpleValue(
                position.line,
                currentLineContent,
                environmentName,
            ),
        }),
    );
}

function parseBlockStartLine(
    { line }: Position,
    docHelper: TextDocumentHelper,
) {
    const openingBrackets = [
        BlockBracket.OpeningBracketForArrayBlock,
        BlockBracket.OpeningBracketForDictionaryOrTextBlock,
    ];
    const closingBrackets = [
        BlockBracket.ClosingBracketForArrayBlock,
        BlockBracket.ClosingBracketForDictionaryOrTextBlock,
    ];
    const blockStartPattern = new RegExp(
        `^\\s*[^\\${openingBrackets.concat(closingBrackets).join("\\")}]*?\\s*(\\${openingBrackets.join("|\\")})?\\s*$`,
        "m",
    );

    const matches = docHelper.getLineByIndex(line).match(blockStartPattern);

    if (!matches || matches.length == 0) {
        return undefined;
    }

    const blockOpeningBracket = [
        BlockBracket.OpeningBracketForArrayBlock,
        BlockBracket.OpeningBracketForDictionaryOrTextBlock,
    ].find((bracketType) => matches[0].includes(bracketType));

    return {
        openingBracket: blockOpeningBracket,
        openingBracketIndex: blockOpeningBracket
            ? matches[0].indexOf(blockOpeningBracket)
            : undefined,
    };
}

function mapToCompletionItems(
    baseRequest: LanguageFeatureBaseRequest,
    additionalData: {
        validBlocks: BlockData[];
        blocksRequiringAdditionalTextEdits: {
            data: BlockData;
            additionalTextEdits: TextEdit[];
        }[];
        fileType: BrunoFileType;
        collection: TypedCollection;
        requestType?: string;
        blockStartBracketPosition?: Position;
    },
): CompletionItem[] {
    const {
        validBlocks,
        blocksRequiringAdditionalTextEdits,
        collection,
        fileType,
        requestType,
        blockStartBracketPosition,
    } = additionalData;
    return validBlocks
        .map((data) => ({ data, additionalTextEdits: [] as TextEdit[] }))
        .concat(blocksRequiringAdditionalTextEdits)
        .map(({ data: blockData, additionalTextEdits }) => {
            const { blockName, mandatory } = blockData;

            const textEditWithInsertFormat = getTextEditWithInsertFormat(
                baseRequest,
                blockName,
                fileType,
                collection,
                requestType,
                blockStartBracketPosition,
            );

            return textEditWithInsertFormat
                ? {
                      label: blockName,
                      ...textEditWithInsertFormat,
                      additionalTextEdits,
                      sortText: mandatory ? `a_${blockName}` : `b_${blockName}`,
                      labelDetails: mandatory
                          ? undefined
                          : { description: "optional" },
                      detail: shouldBeDictionaryBlock(blockName)
                          ? "Dictionary block"
                          : shouldBeArrayBlock(blockName)
                            ? "Array block"
                            : shouldBeCodeBlock(blockName)
                              ? "Code block"
                              : "Text block",
                  }
                : undefined;
        })
        .filter((val) => val != undefined);
}

function getTextEditWithInsertFormat(
    baseRequest: LanguageFeatureBaseRequest,
    blockName: string,
    fileType: BrunoFileType,
    collection: TypedCollection,
    requestType?: string,
    blockStartBracketPosition?: Position,
):
    | { textEdit: TextEdit | undefined; insertTextFormat?: InsertTextFormat }
    | undefined {
    const {
        documentHelper,
        position: { line },
    } = baseRequest;
    const fullLineRange = documentHelper.getRangeForLine(line);
    if (!fullLineRange) {
        return undefined;
    }
    const lineBreak = documentHelper.getMostUsedLineBreak() ?? LineBreakType.Lf;

    if (blockStartBracketPosition) {
        // Avoid overwriting existing content, if already defined.
        return {
            textEdit: {
                newText: `${blockName} `,
                range: new Range(
                    fullLineRange.start,
                    blockStartBracketPosition,
                ),
            },
        };
    }

    const useBracketsForArrayBlock = shouldBeArrayBlock(blockName);
    const openingBracket = useBracketsForArrayBlock
        ? BlockBracket.OpeningBracketForArrayBlock
        : BlockBracket.OpeningBracketForDictionaryOrTextBlock;
    const closingBracket = useBracketsForArrayBlock
        ? BlockBracket.ClosingBracketForArrayBlock
        : BlockBracket.ClosingBracketForDictionaryOrTextBlock;
    const commonBlockStartLine = `${blockName} ${openingBracket}${lineBreak}`;
    const commonBlockEndLine = closingBracket;
    const defaultContent = `${" ".repeat(getDefaultIndentationForDictionaryBlockFields())}\${0}${lineBreak}`;
    return {
        textEdit: {
            newText: commonBlockStartLine.concat(
                shouldBeDictionaryBlock(blockName)
                    ? (getDictionaryBlockSnippetInsertionContent(
                          blockName,
                          {
                              baseRequest,
                              fileType,
                              collection,
                              lineBreak,
                              requestType,
                          },
                          fileType == BrunoFileType.CollectionSettingsFile,
                      ) ?? defaultContent)
                    : defaultContent,
                commonBlockEndLine,
            ),
            range: fullLineRange,
        },
        insertTextFormat: InsertTextFormat.Snippet,
    };
}

function mapToBlockData(missingBlocks: MissingBlock[]): BlockData[] {
    return missingBlocks.flatMap((entry) =>
        "mutuallyExclusiveBlocks" in entry
            ? entry.mutuallyExclusiveBlocks.map((name) => ({
                  blockName: name,
                  mandatory: entry.mandatory,
              }))
            : [
                  {
                      blockName: entry.name,
                      mandatory: entry.mandatory,
                  },
              ],
    );
}

function filterOutNonMatchingBlockTypes(
    missingBlocks: BlockData[],
    openingBracket: BlockBracket,
) {
    return missingBlocks.filter(({ blockName }) =>
        openingBracket == BlockBracket.OpeningBracketForArrayBlock
            ? shouldBeArrayBlock(blockName)
            : !shouldBeArrayBlock(blockName),
    );
}
