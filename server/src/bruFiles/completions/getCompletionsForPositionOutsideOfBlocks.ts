import {
    Block,
    BlockBracket,
    BrunoFileType,
    getDefaultIndentationForDictionaryBlockFields,
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
import { findBlockEnd } from "../../../../shared/fileParsing/internal/findBlockEnd";
import { getDictionaryBlockSnippetInsertionContent } from "./dictionaryBlocks/generic/getDictionaryBlockSnippetInsertionContent";

interface BlockData {
    blockName: string;
    mandatory: boolean;
    endPosition?: Position;
}

export function getCompletionsForPositionOutsideOfBlocks(
    request: LanguageFeatureBaseRequest,
    fileType: BrunoFileType,
    allBlocks: Block[],
    collection: TypedCollection,
): CompletionItem[] | undefined {
    const { position, documentHelper } = request;
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
        blocksThatCannotBeOptional,
    );

    const allMissingBlocks = mapToBlockData(
        request,
        missingMandatoryBlocks.concat(missingOptionalBlocks),
    );
    const filteredItems = openingBracket
        ? filterOutNonMatchingBlockTypes(allMissingBlocks, openingBracket)
        : allMissingBlocks;

    return mapToCompletionItems(
        request,
        filteredItems,
        fileType,
        collection,
        openingBracketIndex
            ? new Position(position.line, openingBracketIndex)
            : undefined,
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
    blocks: BlockData[],
    fileType: BrunoFileType,
    collection: TypedCollection,
    blockStartBracketPosition?: Position,
): CompletionItem[] {
    return blocks
        .map((blockData) => {
            const { blockName, mandatory } = blockData;

            const textEditWithInsertFormat = getTextEditWithInsertFormat(
                baseRequest,
                blockData,
                fileType,
                collection,
                blockStartBracketPosition,
            );

            return textEditWithInsertFormat
                ? {
                      label: blockName,
                      ...textEditWithInsertFormat,
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
    { blockName }: BlockData,
    fileType: BrunoFileType,
    collection: TypedCollection,
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

    const usBracketsForArrayBlock = shouldBeArrayBlock(blockName);
    const openingBracket = usBracketsForArrayBlock
        ? BlockBracket.OpeningBracketForArrayBlock
        : BlockBracket.OpeningBracketForDictionaryOrTextBlock;
    const closingBracket = usBracketsForArrayBlock
        ? BlockBracket.ClosingBracketForArrayBlock
        : BlockBracket.ClosingBracketForDictionaryOrTextBlock;
    const commonBlockStartLine = `${blockName} ${openingBracket}${lineBreak}`;
    const commonBlockEndLine = closingBracket;
    const defaultContent = `${" ".repeat(getDefaultIndentationForDictionaryBlockFields())}\${0}${lineBreak}`;
    return {
        textEdit: {
            newText: commonBlockStartLine.concat(
                shouldBeDictionaryBlock(blockName)
                    ? (getDictionaryBlockSnippetInsertionContent(blockName, {
                          baseRequest,
                          fileType,
                          collection,
                          lineBreak,
                      }) ?? defaultContent)
                    : defaultContent,
                commonBlockEndLine,
            ),
            range: fullLineRange,
        },
        insertTextFormat: InsertTextFormat.Snippet,
    };
}

function mapToBlockData(
    { documentHelper, position: { line } }: LanguageFeatureBaseRequest,
    missingBlocks: MissingBlock[],
) {
    return missingBlocks.flatMap((entry) =>
        "mutuallyExclusiveBlocks" in entry
            ? entry.mutuallyExclusiveBlocks.map((name) => ({
                  blockName: name,
                  mandatory: entry.mandatory,
                  endPosition: findBlockEnd(
                      documentHelper,
                      line + 1,
                      shouldBeArrayBlock(name),
                  ),
              }))
            : [
                  {
                      blockName: entry.name,
                      mandatory: entry.mandatory,
                      endPosition: findBlockEnd(
                          documentHelper,
                          line + 1,
                          shouldBeArrayBlock(entry.name),
                      ),
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
