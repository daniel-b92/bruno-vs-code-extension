import {
    Block,
    BlockBracket,
    BrunoFileType,
    Position,
    Range,
    shouldBeArrayBlock,
    TextDocumentHelper,
} from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../shared";
import { CompletionItem } from "vscode-languageserver";
import { MissingBlock } from "../shared/interfaces";
import { getMissingMandatoryBlocks } from "../shared/getMissingMandatoryBlocks";
import { getMissingOptionalBlocks } from "../shared/getMissingOptionalBlocks";

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

    const allMissingBlocks = mapToBlockNames(
        missingMandatoryBlocks.concat(missingOptionalBlocks),
    );
    const filteredItems = openingBracket
        ? filterOutNonMatchingBlockTypes(allMissingBlocks, openingBracket)
        : allMissingBlocks;

    return mapToCompletionItems(
        request,
        filteredItems,
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
    { position: { line }, documentHelper }: LanguageFeatureBaseRequest,
    blocks: { blockName: string; mandatory: boolean }[],
    blockStartBracketPosition?: Position,
) {
    const fullLineRange = documentHelper.getRangeForLine(line);
    if (!fullLineRange) {
        return undefined;
    }

    const range = new Range(
        fullLineRange.start,
        blockStartBracketPosition
            ? blockStartBracketPosition
            : fullLineRange.end,
    );

    return blocks.map(({ blockName, mandatory }) => ({
        label: blockName,
        textEdit: {
            newText: `${blockName} `,
            range,
        },
        sortText: mandatory ? `a_${blockName}` : `b_${blockName}`,
        labelDetails: mandatory ? undefined : { detail: ` optional` },
    }));
}

function mapToBlockNames(missingBlocks: MissingBlock[]) {
    return missingBlocks.flatMap((entry) =>
        "mutuallyExclusiveBlocks" in entry
            ? entry.mutuallyExclusiveBlocks.map((name) => ({
                  blockName: name,
                  mandatory: entry.mandatory,
              }))
            : [{ blockName: entry.name, mandatory: entry.mandatory }],
    );
}

function filterOutNonMatchingBlockTypes(
    missingBlocks: { blockName: string; mandatory: boolean }[],
    openingBracket: BlockBracket,
) {
    return missingBlocks.filter(({ blockName }) =>
        openingBracket == BlockBracket.OpeningBracketForArrayBlock
            ? shouldBeArrayBlock(blockName)
            : !shouldBeArrayBlock(blockName),
    );
}
