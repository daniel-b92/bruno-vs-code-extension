import { TextDocumentHelper } from "../../fileSystem/textDocumentHelper";
import { getBlockContent } from "../internal/getBlockContent";
import {
    getBlockType,
    Position,
    BlockBracket,
    getBlockStartPatternByName,
    Range,
} from "../..";
import { findBlockEnd } from "../internal/findBlockEnd";

export const parseBlockFromFile = (
    fullDocHelper: TextDocumentHelper,
    blockName: string,
) => {
    const maybeMatches = fullDocHelper
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
        fullDocHelper
            .getText()
            .substring(
                0,
                (maybeMatches.index as number) +
                    maybeMatches[0].indexOf(openingBracket) +
                    1,
            ),
    );
    const lineIndex = subDocumentUntilBlockStart.getLineCount() - 1;

    const startingBracketPosition = new Position(
        lineIndex,
        subDocumentUntilBlockStart
            .getLineByIndex(lineIndex)
            .lastIndexOf(openingBracket),
    );
    const blockEndPosition = findBlockEnd(
        fullDocHelper,
        lineIndex + 1,
        getBlockType(
            subDocumentUntilBlockStart.getLineByIndex(lineIndex),
            blockName,
        ),
    );
    return blockEndPosition
        ? getBlockContent(
              fullDocHelper,
              new Range(
                  // The block content starts in the line after the one with the block name.
                  new Position(startingBracketPosition.line + 1, 0),
                  // The block content ends in the line before the one with closing bracket.
                  new Position(
                      blockEndPosition.line - 1,
                      fullDocHelper.getLineByIndex(blockEndPosition.line - 1)
                          .length,
                  ),
              ),
              getBlockType(maybeMatches[0], blockName),
          )?.content
        : undefined;
};
