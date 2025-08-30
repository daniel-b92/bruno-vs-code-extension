import {
    DictionaryBlockSimpleField,
    PlainTextWithinBlock,
    Position,
    Range,
    TextDocumentHelper,
} from "../..";
import { BlockBracket } from "./util/blockBracketEnum";
import { getContentRangeForArrayOrDictionaryBlock } from "./util/getContentRangeForArrayOrDictionaryBlock";

export function parseDictionaryBlock(
    document: TextDocumentHelper,
    firstContentLine: number,
) {
    const lines: {
        content: DictionaryBlockSimpleField | PlainTextWithinBlock;
    }[] = [];
    let openBracketsOnBlockLevel = 1;
    let lineIndex = firstContentLine;

    while (
        openBracketsOnBlockLevel > 0 &&
        lineIndex < document.getLineCount()
    ) {
        const line = document.getLineByIndex(lineIndex);

        const hasCorrectStructure = isKeyValuePair(line);

        if (hasCorrectStructure) {
            lines.push({
                content: getKeyAndValueFromLine(
                    lineIndex,
                    line,
                ) as DictionaryBlockSimpleField,
            });

            lineIndex++;
        } else {
            const openingBracketsMatches = line.match(
                new RegExp(
                    `\\${BlockBracket.OpeningBracketForDictionaryOrTextBlock}`,
                ),
            );
            const closingBracketsMatches = line.match(
                new RegExp(
                    `\\${BlockBracket.ClosingBracketForDictionaryOrTextBlock}`,
                ),
            );

            // Only count brackets for block level, if they are not within a dictionary key or value entry.
            openBracketsOnBlockLevel =
                openBracketsOnBlockLevel +
                (openingBracketsMatches ? openingBracketsMatches.length : 0) -
                (closingBracketsMatches ? closingBracketsMatches.length : 0);

            // the block content is exclusive of the block's closing bracket line
            if (openBracketsOnBlockLevel > 0) {
                lines.push({
                    content: {
                        text: line,
                        range: document.getRangeForLine(lineIndex) as Range,
                    },
                });

                lineIndex++;
            }
        }
    }

    if (openBracketsOnBlockLevel > 0) {
        return undefined;
    }

    return {
        content: lines.map(({ content }) => content),
        contentRange: getContentRangeForArrayOrDictionaryBlock(
            firstContentLine,
            BlockBracket.ClosingBracketForDictionaryOrTextBlock,
            lineIndex,
            document.getLineByIndex(lineIndex),
        ),
    };
}

const isKeyValuePair = (lineText: string) =>
    getKeyValuePairLinePattern().test(lineText);

const getKeyAndValueFromLine = (
    lineIndex: number,
    lineText: string,
): DictionaryBlockSimpleField | undefined => {
    const matches = getKeyValuePairLinePattern().exec(lineText);

    if (matches && matches.length > 2) {
        const key = matches[1];
        const value = matches[2];
        const keyStartIndex = lineText.indexOf(key);
        const keyEndIndex = keyStartIndex + key.length;
        const valueStartIndex =
            keyEndIndex + lineText.substring(keyEndIndex).indexOf(value);

        return {
            key,
            value,
            keyRange: new Range(
                new Position(lineIndex, keyStartIndex),
                new Position(lineIndex, keyEndIndex),
            ),
            valueRange: new Range(
                new Position(lineIndex, valueStartIndex),
                new Position(lineIndex, valueStartIndex + value.length),
            ),
        };
    } else {
        return undefined;
    }
};

const getKeyValuePairLinePattern = () => /^\s*(\S+)\s*:\s*(\S+.*?|.{0})\s*$/;
