import {
    Block,
    BlockBracket,
    BrunoFileType,
    getDefaultIndentationForDictionaryBlockFields,
    getExtensionForBrunoFiles,
    getMandatoryKeysForMethodBlock,
    getMetaBlockMandatoryKeys,
    getPossibleMethodBlocks,
    LineBreakType,
    MetaBlockKey,
    Position,
    Range,
    RequestFileBlockName,
    RequestType,
    shouldBeArrayBlock,
    shouldBeDictionaryBlock,
    TextDocumentHelper,
} from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../shared";
import {
    CompletionItem,
    InsertTextFormat,
    TextEdit,
} from "vscode-languageserver";
import { MissingBlock } from "../shared/interfaces";
import { getMissingMandatoryBlocks } from "../shared/getMissingMandatoryBlocks";
import { getMissingOptionalBlocks } from "../shared/getMissingOptionalBlocks";
import { findBlockEnd } from "../../../../shared/fileParsing/internal/findBlockEnd";
import { basename } from "path";

interface BlockData {
    blockName: string;
    mandatory: boolean;
    endPosition?: Position;
}

export function getCompletionsForPositionOutsideOfBlocks(
    request: LanguageFeatureBaseRequest,
    fileType: BrunoFileType,
    allBlocks: Block[],
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
    blockStartBracketPosition?: Position,
) {
    return blocks.map((blockData) => {
        const { blockName, mandatory } = blockData;

        return {
            label: blockName,
            ...getTextEditWithInsertFormat(
                baseRequest,
                blockData,
                fileType,
                blockStartBracketPosition,
            ),
            sortText: mandatory ? `a_${blockName}` : `b_${blockName}`,
            labelDetails: mandatory ? undefined : { detail: ` optional` },
        };
    });
}

function getTextEditWithInsertFormat(
    baseRequest: LanguageFeatureBaseRequest,
    { blockName }: BlockData,
    fileType: BrunoFileType,
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

    if (!blockStartBracketPosition) {
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
                        ? (getDictionaryBlockInsertionContent(
                              baseRequest,
                              blockName,
                              fileType,
                              lineBreak,
                          ) ?? defaultContent)
                        : defaultContent,
                    commonBlockEndLine,
                ),
                range: fullLineRange,
            },
            insertTextFormat: InsertTextFormat.Snippet,
        };
    }

    return {
        textEdit: {
            newText: `${blockName} `,
            range: new Range(fullLineRange.start, blockStartBracketPosition),
        },
    };
}

function getDictionaryBlockInsertionContent(
    { filePath }: LanguageFeatureBaseRequest,
    blockName: string,
    fileType: BrunoFileType,
    lineBreak: LineBreakType,
): string | undefined {
    if (blockName == RequestFileBlockName.Meta) {
        const mandatoryKeys = getMetaBlockMandatoryKeys(fileType);

        if (!mandatoryKeys) {
            return undefined;
        }

        const fields = mandatoryKeys.map((key) => {
            if (key == MetaBlockKey.Name) {
                return {
                    key,
                    predefinedValues: basename(
                        filePath,
                        getExtensionForBrunoFiles(),
                    ),
                };
            }
            if (key == MetaBlockKey.Sequence) {
                // ToDo: Determine sensible sequence from collection
                return { key, predefinedValues: "1" };
            }
            if (key == MetaBlockKey.Type) {
                return { key, predefinedValues: Object.values(RequestType) };
            }
            return { key };
        });

        return mandatoryKeys
            ? getSnippetPartForDictionaryBlockContent(fields, lineBreak)
            : undefined;
    }

    if ((getPossibleMethodBlocks() as string[]).includes(blockName)) {
        const mandatoryKeys = getMandatoryKeysForMethodBlock(blockName);
        return mandatoryKeys
            ? getSnippetPartForDictionaryBlockContent(
                  mandatoryKeys.map((key) => ({ key })),
                  lineBreak,
              )
            : undefined;
    }
}

function getSnippetPartForDictionaryBlockContent(
    fields: { key: string; predefinedValues?: string | string[] }[],
    lineBreak: LineBreakType,
) {
    const defaultFieldIndentation =
        getDefaultIndentationForDictionaryBlockFields();
    const fieldsWithSnippetIndizes = fields
        .filter(({ predefinedValues }) => predefinedValues != undefined)
        .map((field, index) => ({ ...field, snippetIndex: index + 1 }));

    return fields
        .map(({ key, predefinedValues }) => {
            const lineBegin = " "
                .repeat(defaultFieldIndentation)
                .concat(key, ":");

            if (!predefinedValues) {
                return lineBegin;
            }

            const snippetIndex = fieldsWithSnippetIndizes.find(
                ({ key: k }) => key == k,
            )!.snippetIndex;

            return Array.isArray(predefinedValues)
                ? `${lineBegin} $\{${snippetIndex}|${predefinedValues.join(",")}|\}`
                : `${lineBegin} $\{${snippetIndex}:${predefinedValues}\}`;
        })
        .join(lineBreak)
        .concat(lineBreak);
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
