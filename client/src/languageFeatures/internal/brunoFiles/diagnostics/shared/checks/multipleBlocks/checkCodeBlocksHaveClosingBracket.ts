import { DiagnosticSeverity } from "vscode";
import {
    Block,
    BlockBracket,
    parseBruFile,
    TextDocumentHelper,
    getCodeBlocks,
} from "@global_shared";
import { mapToVsCodeRange } from "@shared";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";

export function checkCodeBlocksHaveClosingBracket(
    documentHelper: TextDocumentHelper,
    allBlocks: Block[],
): DiagnosticWithCode | undefined {
    const codeBlocksSortedByPosition = getSortedBlocksByPosition(
        getCodeBlocks(allBlocks),
    );

    if (codeBlocksSortedByPosition.length == 0) {
        return undefined;
    }

    const codeBlockWithoutClosingBracket = codeBlocksSortedByPosition.find(
        ({ name, contentRange }) => {
            // If the block is missing a closing bracket, the content range will grow every time a closing bracket is added at the end of the last line of the document.
            const documentHelperWithAdditionalClosingBracket =
                new TextDocumentHelper(
                    `${documentHelper.getText()}${BlockBracket.ClosingBracketForDictionaryOrTextBlock}`,
                );

            const blockForModifiedDocument = parseBruFile(
                documentHelperWithAdditionalClosingBracket,
            ).blocks.find(
                ({ name: modifiedBlockName }) => modifiedBlockName == name,
            );

            if (
                !blockForModifiedDocument ||
                !(blockForModifiedDocument.content as string)
            ) {
                return false;
            }

            return !blockForModifiedDocument.contentRange.end.equals(
                contentRange.end,
            );
        },
    );

    return codeBlockWithoutClosingBracket
        ? getDiagnostic(codeBlockWithoutClosingBracket)
        : undefined;
}

function getDiagnostic(
    codeBlockWithoutClosingBracket: Block,
): DiagnosticWithCode {
    return {
        message: `Block '${codeBlockWithoutClosingBracket.name}' seems to be missing a closing bracket.`,
        range: mapToVsCodeRange(codeBlockWithoutClosingBracket.contentRange),
        severity: DiagnosticSeverity.Error,
        code: NonBlockSpecificDiagnosticCode.CodeBlockMissingClosingBracket,
    };
}
