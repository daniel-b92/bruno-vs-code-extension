import {
    CodeBlock,
    Position,
    Range,
    TextDocumentHelper,
    BlockBracket,
    getCodeBlocks,
    parseBruFile,
    LineBreakType,
} from "@global_shared";
import { format } from "prettier";
import { TextEdit } from "vscode-languageserver/node";
import { mapBlockNameToJsFileLine } from "../shared/mapBlockNameToJsFileLine";
import { TextDocument } from "vscode-languageserver-textdocument";

export async function getHandlerForFormatting(
    textDocument: TextDocument,
): Promise<TextEdit[]> {
    const documentHelper = new TextDocumentHelper(textDocument.getText());
    const codeBlocks = getCodeBlocks(parseBruFile(documentHelper).blocks);

    const lineBreak = documentHelper.getMostUsedLineBreak();

    return Promise.all(
        codeBlocks.map((block) => getTextEditForCodeBlock(block, lineBreak)),
    ).then((textEdits) => textEdits.filter((val) => val != undefined));
}

async function getTextEditForCodeBlock(
    block: CodeBlock,
    documentLineBreak?: LineBreakType,
): Promise<TextEdit | undefined> {
    const toFormat = `${mapBlockNameToJsFileLine(block.name)}${documentLineBreak}${block.content}}`;

    const formattedWithDummyFunctionReplacement = await format(toFormat, {
        parser: "typescript",
        endOfLine:
            documentLineBreak == LineBreakType.Lf
                ? "lf"
                : documentLineBreak == LineBreakType.Crlf
                  ? "crlf"
                  : undefined,
    });

    if (
        !formattedWithDummyFunctionReplacement.includes(
            BlockBracket.ClosingBracketForDictionaryOrTextBlock,
        )
    ) {
        return undefined;
    }

    const docHelperForDummyFunctionReplacement = new TextDocumentHelper(
        formattedWithDummyFunctionReplacement.substring(
            0,
            formattedWithDummyFunctionReplacement.lastIndexOf(
                BlockBracket.ClosingBracketForDictionaryOrTextBlock,
            ) + 1, // The formatter sometimes adds an extra empty line at the end of the text.
        ),
    );

    // If the only line is the function declaration line, there is nothing to format inside the block.
    if (docHelperForDummyFunctionReplacement.getLineCount() < 2) {
        return undefined;
    }

    const lastLineIndex =
        docHelperForDummyFunctionReplacement.getLineCount() - 1;

    return {
        range: new Range(
            block.contentRange.start,
            new Position(
                block.contentRange.end.line,
                block.contentRange.end.character + 1, // block content does not end until the closing bracket char is reached
            ),
        ),
        newText: docHelperForDummyFunctionReplacement.getText(
            new Range(
                new Position(1, 0),
                new Position(
                    lastLineIndex,
                    docHelperForDummyFunctionReplacement.getLineByIndex(
                        lastLineIndex,
                    ).length, // The last line is the same for the dummy function replacement as for the real block. In both cases it will only contain the closing bracket.
                ),
            ),
        ),
    };
}
