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
                new RegExp(`(${LinebreakType.lf}|${LinebreakType.crlf})`)
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
                linebreakIndex + linebreak.length
            );
        }

        this.lines.lastLine = remainingText;
    }

    private lines: {
        fullLines: { content: string; linebreak: LinebreakType }[];
        lastLine: string | undefined;
    } = { fullLines: [], lastLine: undefined };

    public getAllLines(
        startIndex: number
    ): { index: number; content: string }[] {
        if (startIndex >= this.getLineCount()) {
            throw new Error(
                `startIndex '${startIndex}' for document text is invalid. The document only has ${this.getLineCount()} lines.`
            );
        }

        return this.lines.fullLines
            .slice(startIndex)
            .map(({ content }, i) => ({
                index: i + startIndex,
                content,
            }))
            .concat(
                this.lines.lastLine
                    ? [
                          {
                              index: this.lines.fullLines.length,
                              content: this.lines.lastLine,
                          },
                      ]
                    : []
            );
    }

    public getTextRange(startPosition?: Position) {
        return new Range(
            startPosition ? startPosition : new Position(0, 0),
            new Position(
                this.getLineCount() - 1,
                this.getLineByIndex(this.getLineCount() - 1).length
            )
        );
    }

    public getRangeForLine(lineIndex: number) {
        return this.getLineCount() <= lineIndex
            ? undefined
            : new Range(
                  new Position(lineIndex, 0),
                  new Position(lineIndex, this.getLineByIndex(lineIndex).length)
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
            (this.lines.lastLine && this.lines.lastLine.length > 0 ? 1 : 0)
        ); // The last line needs to be counted separately
    }

    public getFullTextWithReplacement(
        toReplace: {
            lineIndex: number;
            startCharIndex: number;
            endCharIndex: number;
        },
        replacement: string
    ) {
        if (toReplace.lineIndex >= this.getLineCount()) {
            throw new Error(
                `Given range ${JSON.stringify(
                    toReplace,
                    null,
                    2
                )} outside of text range ${JSON.stringify(this.lines, null, 2)}`
            );
        } else if (toReplace.startCharIndex > toReplace.endCharIndex) {
            throw new Error(
                `Start char index for text replacement '${toReplace.startCharIndex}' is larger than end char index '${toReplace.endCharIndex}'`
            );
        }

        const originalLine = this.getLineByIndex(toReplace.lineIndex);
        const adjustedLine = `${originalLine.substring(
            0,
            toReplace.startCharIndex
        )}${replacement}${originalLine.substring(toReplace.endCharIndex + 1)}`;

        return this.lines.fullLines
            .map(
                ({ content, linebreak }, index) =>
                    `${
                        index == toReplace.lineIndex ? adjustedLine : content
                    }${linebreak}`
            )
            .join("")
            .concat(
                toReplace.lineIndex == this.getLineCount() - 1
                    ? adjustedLine
                    : this.lines.lastLine ?? ""
            );
    }

    public getText(range?: Range) {
        if (!range) {
            return this.text;
        }

        if (range.start.line >= this.lines.fullLines.length) {
            return (this.lines.lastLine as string).substring(
                range.start.character,
                range.end.character
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
                      range.end.character
                  )}`
                : (this.lines.lastLine as string).substring(
                      0,
                      range.end.character
                  );
        const linesBetween = this.lines.fullLines.slice(
            range.start.line + 1,
            range.end.line
        );

        return linesBetween
            .reduce(
                (prev, { content, linebreak }) =>
                    prev.concat(content.concat(linebreak)),
                firstLine
            )
            .concat(lastLine);
    }
}

enum LinebreakType {
    lf = "\n",
    crlf = "\r\n",
}
