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
 * Formats the entire Yaml file and the scripts inside of it.
 * Only scripts defined as literal block scalars (`code: |`) are formatted as JavaScript.
 *
 * The scripts are formatted after the Yaml structure, because that may change their indentation.
 * Since the ranges of the script edits refer to the already formatted Yaml, the result is returned as one edit for the whole document.
 */
export async function getHandlerForYamlFormatting(
    textDocument: TextDocument,
    itemType: ItemType,
): Promise<TextEdit[]> {
    const originalText = textDocument.getText();
    const lineBreak =
        new TextDocumentHelper(originalText).getMostUsedLineBreak() ??
        LineBreakType.Lf;

    const yamlFormattedText = await formatYamlStructure(
        originalText,
        lineBreak,
    );
    const yamlFormattedDocument = TextDocument.create(
        textDocument.uri,
        textDocument.languageId,
        textDocument.version,
        yamlFormattedText,
    );
    const finalText = TextDocument.applyEdits(
        yamlFormattedDocument,
        await getTextEditsForScripts(yamlFormattedDocument, itemType),
    );

    return finalText == originalText
        ? []
        : [
              TextEdit.replace(
                  {
                      start: textDocument.positionAt(0),
                      end: textDocument.positionAt(originalText.length),
                  },
                  finalText,
              ),
          ];
}

/**
 * Returns the unchanged text if it cannot be parsed, so that the scripts can still be formatted.
 * Also returns the unchanged text if the file contains block scalars with an explicit indentation indicator,
 * because their content is relative to the parent's indentation, which would be changed by the Yaml formatter.
 */
async function formatYamlStructure(text: string, lineBreak: LineBreakType) {
    if (text.split(/\r?\n/).some(hasExplicitIndentationIndicatorInHeader)) {
        return text;
    }

    try {
        return await format(text, {
            parser: "yaml",
            endOfLine: lineBreak == LineBreakType.Crlf ? "crlf" : "lf",
        });
    } catch {
        return text;
    }
}

async function getTextEditsForScripts(
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
    let formatted: string;
    try {
        formatted = (
            await format(code, {
                parser: "babel",
                endOfLine: lineBreak == LineBreakType.Crlf ? "crlf" : "lf",
            })
        ).trimEnd();
    } catch {
        // Scripts that cannot be parsed are left as they are, so that the other scripts and the Yaml structure are still formatted.
        return undefined;
    }

    const newText = formatted
        .split(lineBreak)
        // Whitespace-only lines are only kept by prettier if they are part of a literal (e.g. a template string), so they must not be changed.
        .map((line) => (line == "" ? "" : `${indentation}${line}`))
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
    return hasExplicitIndentationIndicatorInHeader(
        documentHelper.getLineByIndex(contentRange.start.line - 1),
    );
}

function hasExplicitIndentationIndicatorInHeader(headerLine: string) {
    return /[|>](?:[+-]?\d|\d[+-]?)\s*(?:#.*)?$/.test(headerLine);
}

function getIndentation(line: string) {
    return line.substring(0, line.length - line.trimStart().length);
}
