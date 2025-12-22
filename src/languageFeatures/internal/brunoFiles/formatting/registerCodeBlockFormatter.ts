import { languages, TextEdit } from "vscode";
import {
    CodeBlock,
    getLineBreak,
    mapToVsCodeRange,
    OutputChannelLogger,
    parseBruFile,
    Position,
    Range,
    TextDocumentHelper,
    BlockBracket,
    getCodeBlocks,
} from "../../../../shared";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { format } from "prettier";
import { mapBlockNameToJsFileLine } from "../shared/codeBlocksUtils/mapBlockNameToJsFileFunctionName";

export function registerCodeBlockFormatter(_logger?: OutputChannelLogger) {
    return languages.registerDocumentFormattingEditProvider(
        getRequestFileDocumentSelector(),
        {
            async provideDocumentFormattingEdits(document, _options, _token) {
                const { blocks } = parseBruFile(
                    new TextDocumentHelper(document.getText()),
                );

                const codeBlocks = getCodeBlocks(blocks);
                const lineBreak = getLineBreak(document);

                const textEdits: Promise<TextEdit | undefined>[] = [];

                for (const block of codeBlocks) {
                    textEdits.push(getTextEditForCodeBlock(block, lineBreak));
                }

                return (await Promise.all(textEdits)).filter(
                    (edit) => edit,
                ) as TextEdit[];
            },
        },
    );
}

async function getTextEditForCodeBlock(
    block: CodeBlock,
    documentLineBreak: string,
) {
    const toFormat = `${mapBlockNameToJsFileLine(block.name)}${documentLineBreak}${block.content.asPlainText}}`;

    const formattedWithDummyFunctionReplacement = await format(toFormat, {
        parser: "typescript",
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

    return new TextEdit(
        mapToVsCodeRange(
            new Range(
                block.contentRange.start,
                new Position(
                    block.contentRange.end.line,
                    block.contentRange.end.character + 1, // block content does not end until the closing bracket char is reached
                ),
            ),
        ),
        docHelperForDummyFunctionReplacement.getText(
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
    );
}
