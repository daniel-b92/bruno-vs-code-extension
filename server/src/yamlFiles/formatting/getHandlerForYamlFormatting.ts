import {
    getScriptBlocksFromYamlFile,
    ItemType,
    LineBreakType,
    Position,
    Range,
    TextDocumentHelper,
    YamlScriptBlock,
} from "@global_shared";
import { format } from "prettier";
import { TextEdit } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

/**
 * Formats the scripts of a Yaml file. Only scripts defined as literal block scalars (`code: |`) are formatted.
 */
export async function getHandlerForYamlFormatting(
    textDocument: TextDocument,
    itemType: ItemType,
): Promise<TextEdit[]> {
    const documentHelper = new TextDocumentHelper(textDocument.getText());
    const lineBreak = documentHelper.getMostUsedLineBreak() ?? LineBreakType.Lf;

    const { blocks } = getScriptBlocksFromYamlFile(documentHelper, itemType);

    return Promise.all(
        blocks.map((block) =>
            getTextEditForScript(block, documentHelper, lineBreak),
        ),
    ).then((textEdits) => textEdits.filter((val) => val != undefined));
}

async function getTextEditForScript(
    { contentRange }: YamlScriptBlock,
    documentHelper: TextDocumentHelper,
    lineBreak: LineBreakType,
): Promise<TextEdit | undefined> {
    if (hasExplicitIndentationIndicator(contentRange, documentHelper)) {
        // The indentation of the first line is significant in this case, so it must not be changed.
        return undefined;
    }

    const lines = documentHelper
        .getAllLines()
        .filter(
            ({ index }) =>
                index >= contentRange.start.line &&
                index <= contentRange.end.line,
        );
    const nonBlankLines = lines.filter(({ content }) => content.trim() != "");

    if (nonBlankLines.length == 0) {
        return undefined;
    }

    // Leading and trailing blank lines are kept as they are.
    const firstLine = nonBlankLines[0];
    const lastLine = nonBlankLines[nonBlankLines.length - 1];

    // Yaml determines the indentation of a block scalar from its first non-empty line.
    const indentation = getIndentation(firstLine.content);
    const code = lines
        .filter(
            ({ index }) => index >= firstLine.index && index <= lastLine.index,
        )
        .map(({ content }) => content.substring(indentation.length))
        .join(lineBreak);

    // Scripts are executed inside of a function, so `return` and `await` are valid at the top level.
    const formatted = (
        await format(code, {
            parser: "babel",
            endOfLine: lineBreak == LineBreakType.Crlf ? "crlf" : "lf",
        })
    ).trimEnd();

    const newText = formatted
        .split(lineBreak)
        .map((line) => (line.trim() == "" ? "" : `${indentation}${line}`))
        .join(lineBreak);

    const range = new Range(
        new Position(firstLine.index, 0),
        new Position(lastLine.index, lastLine.content.length),
    );

    return newText == documentHelper.getText(range)
        ? undefined
        : { range, newText };
}

function hasExplicitIndentationIndicator(
    contentRange: Range,
    documentHelper: TextDocumentHelper,
) {
    const headerLine = documentHelper.getLineByIndex(
        contentRange.start.line - 1,
    );

    return /[|>](?:[+-]?\d|\d[+-]?)/.test(headerLine);
}

function getIndentation(line: string) {
    return line.substring(0, line.length - line.trimStart().length);
}
