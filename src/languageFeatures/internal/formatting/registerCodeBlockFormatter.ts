import { languages, TextEdit } from "vscode";
import {
    getLineBreakForDocument,
    mapRange,
    OutputChannelLogger,
    parseBruFile,
    Position,
    Range,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../shared";
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
                const lineBreak = getLineBreakForDocument(document);

                const textEdits: TextEdit[] = [];

                for (const block of codeBlocks) {
                    const formattedWithDummyFunction = await format(
                        `${mapBlockNameToJsFileLine(block.name as RequestFileBlockName)}${lineBreak}${block.content.toString()}${lineBreak}}`,
                        {
                            parser: "typescript",
                        },
                    );

                    const docHelperForBlock = new TextDocumentHelper(
                        formattedWithDummyFunction,
                    );
                    const lastLineOfBlockContentIndex =
                        docHelperForBlock.getLineCount() - 2;
                    const lastLineOfBlockContent =
                        docHelperForBlock.getLineByIndex(
                            lastLineOfBlockContentIndex,
                        );

                    textEdits.push(
                        new TextEdit(
                            mapRange(block.contentRange),
                            docHelperForBlock.getText(
                                new Range(
                                    new Position(1, 0),
                                    new Position(
                                        lastLineOfBlockContentIndex,
                                        lastLineOfBlockContent.length,
                                    ),
                                ),
                            ),
                        ),
                    );
                }

                return textEdits;
            },
        },
    );
}
