import { Position } from "./position";
import { Range } from "./range";

export class TextDocumentHelper {
    constructor(private text: string) {
        let remainingText = text;

        while (
            remainingText.includes(LinebreakType.lf) ||
            remainingText.includes(LinebreakType.crlf)
        ) {
            const linebreakIndex = remainingText.search(
                new RegExp(`(${LinebreakType.lf}|${LinebreakType.crlf})`),
            );
            const linebreak = remainingText
                .substring(linebreakIndex)
                .startsWith(LinebreakType.lf)
                ? LinebreakType.lf
                : LinebreakType.crlf;

            this.lines.fullLines.push({
                content: remainingText.substring(0, linebreakIndex),
                linebreak,
            });
            remainingText = remainingText.substring(
                linebreakIndex + linebreak.length,
            );
        }

        this.lines.lastLine = remainingText;
    }

    private lines: {
        fullLines: { content: string; linebreak: LinebreakType }[];
        lastLine: string | undefined;
    } = { fullLines: [], lastLine: undefined };

    public getAllLines(
        startIndex?: number,
    ): { index: number; content: string }[] {
        if (startIndex != undefined && startIndex >= this.getLineCount()) {
            throw new Error(
                `startIndex '${startIndex}' for document text is invalid. The document only has ${this.getLineCount()} lines.`,
            );
        }

        return this.lines.fullLines
            .slice(startIndex)
            .map(({ content }, i) => ({
                index: i + (startIndex ?? 0),
                content,
            }))
            .concat(
                this.lines.lastLine != undefined
                    ? [
                          {
                              index: this.lines.fullLines.length,
                              content: this.lines.lastLine,
                          },
                      ]
                    : [],
            );
    }

    public getTextRange(startPosition?: Position) {
        return new Range(
            startPosition ? startPosition : new Position(0, 0),
            new Position(
                this.getLineCount() - 1,
                this.getLineByIndex(this.getLineCount() - 1).length,
            ),
        );
    }

    public getRangeForLine(lineIndex: number) {
        return this.getLineCount() <= lineIndex
            ? undefined
            : new Range(
                  new Position(lineIndex, 0),
                  new Position(
                      lineIndex,
                      this.getLineByIndex(lineIndex).length,
                  ),
              );
    }

    public getLineByIndex(index: number) {
        return index < this.lines.fullLines.length
            ? this.lines.fullLines[index].content
            : (this.lines.lastLine as string);
    }

    public getLineCount() {
        return (
            this.lines.fullLines.length +
            (this.lines.lastLine != undefined ? 1 : 0)
        ); // The last line needs to be counted separately
    }

    public getFullTextWithReplacement(
        toReplace: {
            lineIndex: number;
            startCharIndex: number;
            endCharIndex: number;
        },
        replacement: string,
    ) {
        if (toReplace.lineIndex >= this.getLineCount()) {
            throw new Error(
                `Given range ${JSON.stringify(
                    toReplace,
                    null,
                    2,
                )} outside of text range ${JSON.stringify(this.lines, null, 2)}`,
            );
        } else if (toReplace.startCharIndex > toReplace.endCharIndex) {
            throw new Error(
                `Start char index for text replacement '${toReplace.startCharIndex}' is larger than end char index '${toReplace.endCharIndex}'`,
            );
        }

        const originalLine = this.getLineByIndex(toReplace.lineIndex);
        const adjustedLine = `${originalLine.substring(
            0,
            toReplace.startCharIndex,
        )}${replacement}${originalLine.substring(toReplace.endCharIndex + 1)}`;

        return this.lines.fullLines
            .map(
                ({ content, linebreak }, index) =>
                    `${
                        index == toReplace.lineIndex ? adjustedLine : content
                    }${linebreak}`,
            )
            .join("")
            .concat(
                toReplace.lineIndex == this.getLineCount() - 1
                    ? adjustedLine
                    : this.lines.lastLine != undefined
                      ? this.lines.lastLine
                      : "",
            );
    }

    /**
     * Get the text up until all of the scopes opened by the given opening character within the text have been closed by the given closing character.
     * Additionally, one more closing character is expected because the start position is expected to be after the first opening character.
     * @param startLine The line index for starting the search. Should be after the initial opening character (so that at the given position one of the scopes
     * defined by the opening and closing character pairs is already open).
     * @param openingChar The opening character for the scope. Every time this character is found within the given part of the text, the temrination condition will change
     * so that the newly opened scope is closed by a respective closing character additionally.
     * @param closingChar The closing character for the scope.
     */
    public getContentUntilClosingChar(
        startLine: number,
        openingChar: string,
        closingChar: string,
    ): { content: string; range: Range } | undefined {
        const remainingLines = this.getAllLines(startLine).filter(
            ({ index }) => index >= startLine,
        );

        if (remainingLines.length == 0) {
            return undefined;
        }

        const relevantChars = remainingLines.reduce(
            (prev, curr) => {
                const { content, index } = curr;

                if (
                    !content.includes(openingChar) &&
                    !content.includes(closingChar)
                ) {
                    return prev;
                }

                const charsForLine = content
                    .split("")
                    .map((char, i) => ({ char, index: i }))
                    .filter(
                        ({ char }) =>
                            char == openingChar || char == closingChar,
                    );

                return prev.concat({
                    line: { index, chars: charsForLine },
                });
            },
            [] as {
                line: {
                    index: number;
                    chars: { char: string; index: number }[];
                };
            }[],
        );

        let openScopes = 1;
        let closingCharPosition: Position | undefined = undefined;

        for (const { line } of relevantChars) {
            const { index: lineIndex, chars } = line;

            for (const {
                char: currentChar,
                index: currentCharIndex,
            } of chars) {
                if ([openingChar, closingChar].includes(currentChar)) {
                    openScopes += currentChar == openingChar ? 1 : -1;

                    if (openScopes == 0) {
                        closingCharPosition = new Position(
                            lineIndex,
                            currentCharIndex,
                        );

                        break;
                    }
                }
            }
            if (openScopes == 0) {
                break;
            }
        }

        if (!closingCharPosition) {
            return undefined;
        }

        const range = new Range(
            new Position(startLine, 0),
            closingCharPosition,
        );

        return {
            content: this.getText(range),
            range,
        };
    }

    public getPositionForOffset(
        { line: startLine, character: startChar }: Position,
        offset: number,
    ) {
        const lastLineIndex = this.getLineCount() - 1;

        if (
            startLine > lastLineIndex ||
            startChar > this.getLineByIndex(startLine).length
        ) {
            return undefined;
        }

        let currentOffset = 0;

        const lineContainingPosition = this.getAllLines(startLine).find(
            ({ content, index }) => {
                // add 1 for the line break at the end of each line
                const currentTextLengthWithLineBreak =
                    content.length + (index < lastLineIndex ? 1 : 0);

                if (
                    (index < lastLineIndex &&
                        currentOffset + currentTextLengthWithLineBreak >
                            offset) ||
                    (index == lastLineIndex &&
                        currentOffset + currentTextLengthWithLineBreak >=
                            offset)
                ) {
                    return true;
                } else {
                    currentOffset += currentTextLengthWithLineBreak;
                }
            },
        );

        return lineContainingPosition != undefined
            ? new Position(lineContainingPosition.index, offset - currentOffset)
            : undefined;
    }

    public getText(range?: Range) {
        if (!range) {
            return this.text;
        }

        if (range.start.line >= this.lines.fullLines.length) {
            return (this.lines.lastLine as string).substring(
                range.start.character,
                range.end.character,
            );
        }

        const firstLine = `${this.lines.fullLines[
            range.start.line
        ].content.substring(range.start.character)}${
            this.lines.fullLines[range.start.line].linebreak
        }`;
        const lastLine =
            range.end.line < this.lines.fullLines.length
                ? `${this.lines.fullLines[range.end.line].content.substring(
                      0,
                      range.end.character,
                  )}`
                : (this.lines.lastLine as string).substring(
                      0,
                      range.end.character,
                  );
        const linesBetween = this.lines.fullLines.slice(
            range.start.line + 1,
            range.end.line,
        );

        return linesBetween
            .reduce(
                (prev, { content, linebreak }) =>
                    prev.concat(content.concat(linebreak)),
                firstLine,
            )
            .concat(lastLine);
    }
}

enum LinebreakType {
    lf = "\n",
    crlf = "\r\n",
}
