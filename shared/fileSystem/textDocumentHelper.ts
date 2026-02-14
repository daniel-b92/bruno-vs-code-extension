import { LineBreakType } from "./lineBreakTypeEnum";
import { Position } from "./position";
import { Range } from "./range";

export class TextDocumentHelper {
    constructor(private text: string) {
        let remainingText = text;

        while (
            remainingText.includes(LineBreakType.Lf) ||
            remainingText.includes(LineBreakType.Crlf)
        ) {
            const linebreakIndex = remainingText.search(
                new RegExp(`(${LineBreakType.Lf}|${LineBreakType.Crlf})`),
            );
            const lineBreak = remainingText
                .substring(linebreakIndex)
                .startsWith(LineBreakType.Lf)
                ? LineBreakType.Lf
                : LineBreakType.Crlf;

            this.lines.fullLines.push({
                content: remainingText.substring(0, linebreakIndex),
                lineBreak,
            });
            remainingText = remainingText.substring(
                linebreakIndex + lineBreak.length,
            );
        }

        this.lines.lastLine = remainingText;
    }

    private lines: {
        fullLines: { content: string; lineBreak: LineBreakType }[];
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
                ({ content, lineBreak }, index) =>
                    `${
                        index == toReplace.lineIndex ? adjustedLine : content
                    }${lineBreak}`,
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
                // add length of respective line breaks at the end of each line.
                const currentTextLengthWithLineBreak =
                    content.length + (this.getLineBreakLength(index) ?? 0);

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

    public getTextStartingInLine(lineIndex: number) {
        return this.getText(
            new Range(
                new Position(lineIndex, 0),
                new Position(this.getLineCount() - 1, Number.MAX_SAFE_INTEGER),
            ),
        );
    }

    public getOffsetForPosition(position: Position) {
        return this.getText(new Range(new Position(0, 0), position)).length;
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

        if (range.start.line == range.end.line) {
            return this.getLineByIndex(range.start.line).substring(
                range.start.character,
                range.end.character,
            );
        }

        const firstLine = `${this.lines.fullLines[
            range.start.line
        ].content.substring(range.start.character)}${
            this.lines.fullLines[range.start.line].lineBreak
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
                (prev, { content, lineBreak }) =>
                    prev.concat(content.concat(lineBreak)),
                firstLine,
            )
            .concat(lastLine);
    }

    public getMostUsedLineBreak() {
        if (this.lines.fullLines.length == 0) {
            return undefined;
        }

        const usedLineBreaks = this.lines.fullLines.reduce(
            (prev, { lineBreak }) => {
                const indexForLineBreak = prev.findIndex(
                    ({ lineBreak: l }) => lineBreak == l,
                );

                if (indexForLineBreak < 0) {
                    return prev.concat({ lineBreak, occurences: 1 });
                }

                return prev.map((v, index) =>
                    index == indexForLineBreak
                        ? { ...v, occurences: v.occurences + 1 }
                        : v,
                );
            },
            [] as { lineBreak: LineBreakType; occurences: number }[],
        );

        return usedLineBreaks.sort(
            ({ occurences: occurences1 }, { occurences: occurences2 }) =>
                occurences1 - occurences2,
        )[usedLineBreaks.length - 1].lineBreak;
    }

    private getLineBreakLength(lineIndex: number) {
        return this.lines.fullLines.length <= lineIndex
            ? undefined
            : this.lines.fullLines[lineIndex].lineBreak == LineBreakType.Lf
              ? 1
              : 2;
    }
}
