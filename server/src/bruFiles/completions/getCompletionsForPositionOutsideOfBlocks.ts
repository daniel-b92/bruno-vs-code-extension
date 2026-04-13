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
        startLineData.openingBracketIndex < position.character
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

    return mapToCompletionItems(
        filterOutNonMatchingBlockTypes(
            missingMandatoryBlocks.concat(missingOptionalBlocks),
            openingBracket,
        ),
        new Position(position.line, openingBracketIndex),
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
        `^\\s*[^\\${openingBrackets.concat(closingBrackets).join("\\")}}]*?\\s*(\\${openingBrackets.join("|\\")})\\s*$`,
        "m",
    );

    const matches = docHelper.getLineByIndex(line).match(blockStartPattern);

    if (!matches || matches.length == 0) {
        return undefined;
    }

    const blockOpeningBracket = matches[0].includes(
        BlockBracket.OpeningBracketForArrayBlock,
    )
        ? BlockBracket.OpeningBracketForArrayBlock
        : BlockBracket.OpeningBracketForDictionaryOrTextBlock;

    return {
        openingBracket: blockOpeningBracket,
        openingBracketIndex: matches[0].indexOf(blockOpeningBracket),
    };
}

function mapToCompletionItems(
    blocks: { blockName: string; mandatory: boolean }[],
    blockStartBracketPosition: Position,
) {
    return blocks.map(({ blockName, mandatory: isMandatory }) => ({
        label: blockName,
        textEdit: {
            newText: `${blockName} `,
            range: new Range(
                new Position(blockStartBracketPosition.line, 0),
                blockStartBracketPosition,
            ),
        },
        sortText: isMandatory ? `a_${blockName}` : `b_${blockName}`,
        labelDetails: isMandatory ? undefined : { detail: ` optional` },
    }));
}

function filterOutNonMatchingBlockTypes(
    missingBlocks: MissingBlock[],
    openingBracket: BlockBracket,
): { blockName: string; mandatory: boolean }[] {
    return missingBlocks
        .flatMap((entry) =>
            "mutuallyExclusiveBlocks" in entry
                ? entry.mutuallyExclusiveBlocks.map((name) => ({
                      blockName: name,
                      mandatory: entry.mandatory,
                  }))
                : [{ blockName: entry.name, mandatory: entry.mandatory }],
        )
        .filter(({ blockName }) =>
            openingBracket == BlockBracket.OpeningBracketForArrayBlock
                ? shouldBeArrayBlock(blockName)
                : !shouldBeArrayBlock(blockName),
        );
}
