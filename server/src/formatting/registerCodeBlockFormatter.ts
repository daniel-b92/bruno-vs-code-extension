import { languages, TextEdit } from "vscode";
import {
    Block,
    getLineBreak,
    mapRange,
    OutputChannelLogger,
    parseBruFile,
    Position,
    Range,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../sharedred";
import { getRequestFileDocumentSelector } from "../shared/getRequestFileDocumentSelector";
import { getCodeBlocks } from "../shared/codeBlocksUtils/getCodeBlocks";
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

                const textEdits: Promise<TextEdit>[] = [];

                for (const block of codeBlocks) {
                    textEdits.push(getTextEditForBlock(block, lineBreak));
                }

                return await Promise.all(textEdits);
            },
        },
    );
}

async function getTextEditForBlock(block: Block, documentLineBreak: string) {
    const formattedWithDummyFunctionReplacement = await format(
        `${mapBlockNameToJsFileLine(block.name as RequestFileBlockName)}${documentLineBreak}${block.content.toString()}${documentLineBreak}}`,
        {
            parser: "typescript",
        },
    );

    const docHelperForDummyFunctionReplacement = new TextDocumentHelper(
        formattedWithDummyFunctionReplacement,
    );

    const lastLineIndex =
        docHelperForDummyFunctionReplacement.getLineCount() - 1;

    return new TextEdit(
        mapRange(
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
