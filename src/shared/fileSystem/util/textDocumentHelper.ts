import { Range } from "vscode";

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
