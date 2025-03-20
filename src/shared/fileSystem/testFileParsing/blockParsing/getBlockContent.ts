import { Position, Range } from "vscode";
import {
    DictionaryBlockField,
    TextLineSplitterUtility,
} from "../definitions/interfaces";

export const getBlockContent = (
    document: TextLineSplitterUtility,
    startingBracket: Position
): { content: string | DictionaryBlockField[]; contentRange: Range } => {
    const lines: { content: string | DictionaryBlockField }[] = [];
    let openCurlyBrackets = 1;
    // the block content is exclusive of the block's opening curly bracket line
    const firstLine = startingBracket.line + 1;
    let lineIndex = firstLine;

    while (openCurlyBrackets > 0 && lineIndex < document.getLineCount()) {
        const line = document.getLineByIndex(lineIndex);
        const openingBracketsMatches = line.match(/{/);
        const closingBracketsMatches = line.match(/}/);

        openCurlyBrackets =
            openCurlyBrackets +
            (openingBracketsMatches ? openingBracketsMatches.length : 0) -
            (closingBracketsMatches ? closingBracketsMatches.length : 0);

        // the block content is exclusive of the block's closing curly bracket line
        if (openCurlyBrackets > 0) {
            lines.push(
                isKeyValuePair(line)
                    ? {
                          content:
                              getKeyAndValueFromLine(lineIndex, line) ?? line,
                      }
                    : { content: line }
            );
            lineIndex++;
        }
    }

    const range = new Range(
        new Position(firstLine, 0),
        new Position(
            lineIndex,
            document.getLineByIndex(lineIndex).lastIndexOf("}")
        )
    );

    return {
        content: lines.some((line) => typeof line.content == "string")
            ? document.getText(range)
            : (lines as { content: DictionaryBlockField }[]).map(
                  ({ content }) => content
              ),
        contentRange: range,
    };
};

const isKeyValuePair = (lineText: string) =>
    getKeyValuePairLinePattern().test(lineText);

const getKeyAndValueFromLine = (
    lineIndex: number,
    lineText: string
): DictionaryBlockField | undefined => {
    const matches = getKeyValuePairLinePattern().exec(lineText);

    if (matches && matches.length > 2) {
        const name = matches[1];
        const value = matches[2];
        const nameStartIndex = lineText.indexOf(name);
        const nameEndIndex = lineText.indexOf(name);
        const valueStartIndex =
            nameEndIndex + lineText.substring(nameEndIndex).indexOf(value);

        return {
            name,
            value,
            nameRange: new Range(
                new Position(lineIndex, nameStartIndex),
                new Position(lineIndex, nameEndIndex)
            ),
            valueRange: new Range(
                new Position(lineIndex, valueStartIndex),
                new Position(lineIndex, valueStartIndex + value.length)
            ),
        };
    } else {
        return undefined;
    }
};

const getKeyValuePairLinePattern = () => /^\s*(\S+)\s*:\s*(\S+.*?)\s*$/;
