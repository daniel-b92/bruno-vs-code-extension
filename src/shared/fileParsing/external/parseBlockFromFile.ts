import { TextDocumentHelper } from "../../fileSystem/util/textDocumentHelper";
import { getBlockContent } from "../internal/getBlockContent";
import { getBlockStartPatternByName } from "../internal/util/getBlockStartPatternByName";
import { BlockBracket } from "../internal/util/blockBracketEnum";
import { getBlockType, Position } from "../..";

export const parseBlockFromFile = (
    document: TextDocumentHelper,
    blockName: string,
) => {
    const maybeMatches = document
        .getText()
        .match(getBlockStartPatternByName(blockName));

    if (!maybeMatches || maybeMatches.length < 1) {
        return undefined;
    }

    const shouldBeArrayBlock = maybeMatches[0].includes(
        BlockBracket.OpeningBracketForArrayBlock,
    );

    const openingBracket = shouldBeArrayBlock
        ? BlockBracket.OpeningBracketForArrayBlock
        : BlockBracket.OpeningBracketForDictionaryOrTextBlock;

    const subDocumentUntilBlockStart = new TextDocumentHelper(
        document
            .getText()
            .substring(
                0,
                (maybeMatches.index as number) +
                    maybeMatches[0].indexOf(openingBracket) +
                    1,
            ),
    );
    const lineIndex = subDocumentUntilBlockStart.getLineCount() - 1;

    const startingBracket = new Position(
        lineIndex,
        subDocumentUntilBlockStart
            .getLineByIndex(lineIndex)
            .lastIndexOf(openingBracket),
    );
    return getBlockContent(
        document,
        startingBracket,
        getBlockType(maybeMatches[0], blockName),
    )?.content;
};
