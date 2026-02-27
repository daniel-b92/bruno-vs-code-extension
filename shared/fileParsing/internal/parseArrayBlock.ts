import {
    ArrayBlockField,
    PlainTextWithinBlock,
    Position,
    Range,
    TextDocumentHelper,
    BlockBracket,
    BlockType,
} from "../..";
import { getContentRangeForArrayOrDictionaryBlock } from "../external/shared/util/getContentRangeForArrayOrDictionaryBlock";
import { findBlockEnd } from "./findBlockEnd";

export function parseArrayBlock(
    document: TextDocumentHelper,
    firstContentLine: number,
) {
    const allRemainingLines = document.getAllLines(firstContentLine);

    const blockEndPosition = findBlockEnd(
        document,
        firstContentLine,
        BlockType.Array,
    );

    if (!blockEndPosition) {
        return undefined;
    }

    const linesWithBlockContent = allRemainingLines.slice(
        0,
        allRemainingLines.findIndex(
            ({ index }) => index == blockEndPosition.line,
        ),
    );

    const nonFinalBlockLines = linesWithBlockContent.slice(
        0,
        linesWithBlockContent.length - 1,
    );

    const nonFinalLinesNotMatchingPattern: PlainTextWithinBlock[] = [];

    const nonFinalLinesMatchingBlockPattern = nonFinalBlockLines.filter(
        ({ index, content }) => {
            if (getNonFinalArrayBlockLinePattern().test(content)) {
                return true;
            } else {
                nonFinalLinesNotMatchingPattern.push({
                    text: content,
                    range: document.getRangeForLine(index) as Range,
                });
                return false;
            }
        },
    );

    const lastContentLine =
        linesWithBlockContent[linesWithBlockContent.length - 1];
    const doesLastLineMatchBlockPattern = getFinalLinePattern().test(
        lastContentLine.content,
    );

    return {
        content: (
            nonFinalLinesMatchingBlockPattern.map(({ content, index }) =>
                getArrayEntryFromLine(index, content, false),
            ) as (ArrayBlockField | PlainTextWithinBlock)[]
        )
            .concat(
                nonFinalLinesNotMatchingPattern.length > 0
                    ? nonFinalLinesNotMatchingPattern
                    : [],
            )
            .concat(
                doesLastLineMatchBlockPattern
                    ? [
                          getArrayEntryFromLine(
                              lastContentLine.index,
                              lastContentLine.content,
                              true,
                          ),
                      ]
                    : [
                          {
                              text: lastContentLine.content,
                              range: document.getRangeForLine(
                                  lastContentLine.index,
                              ) as Range,
                          },
                      ],
            ),
        contentRange: getContentRangeForArrayOrDictionaryBlock(
            firstContentLine,
            BlockBracket.ClosingBracketForArrayBlock,
            blockEndPosition.line,
            document.getLineByIndex(blockEndPosition.line),
        ),
    };
}

const getArrayEntryFromLine = (
    lineIndex: number,
    lineText: string,
    isLastArrayBlockLine: boolean,
): ArrayBlockField => {
    const isDisabled = lineText.trimStart().startsWith("~");
    const withTrimmedStart = isDisabled
        ? lineText.trimStart().slice(1)
        : lineText.trimStart();

    const entry = isLastArrayBlockLine
        ? withTrimmedStart.trimEnd()
        : withTrimmedStart.replace(",", "").trimEnd();

    const entryStartIndex = lineText.indexOf(entry);
    const entryEndIndex = entryStartIndex + entry.length;

    return {
        disabled: isDisabled,
        entry,
        entryRange: new Range(
            new Position(lineIndex, entryStartIndex),
            new Position(lineIndex, entryEndIndex),
        ),
    };
};

const getFinalLinePattern = () =>
    new RegExp(
        `(${getPatternForDisabledLine()}|${getCommonPatternStartForEnabledLine()}$)`,
        "m",
    );
const getNonFinalArrayBlockLinePattern = () =>
    new RegExp(
        `(${getPatternForDisabledLine()}|${getCommonPatternStartForEnabledLine()},$)`,
        "m",
    );
const getCommonPatternStartForEnabledLine = () =>
    "^\\s*[a-zA-Z0-9-_\\\\.]*\\s*";
const getPatternForDisabledLine = () => "^\\s*~.*$";
