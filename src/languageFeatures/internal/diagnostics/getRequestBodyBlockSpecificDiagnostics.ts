import { Block, TextDocumentHelper } from "../../../shared";
import { DiagnosticWithCode } from "./definitions";
import { checkJsonRequestBodySyntax } from "./requestFiles/checks/singleBlocks/checkJsonRequestBodySyntax";

export function getRequestBodyBlockSpecificDiagnostics(
    document: TextDocumentHelper,
    bodyBlock: Block
): (DiagnosticWithCode | undefined)[] {
    return [checkJsonRequestBodySyntax(document, bodyBlock)];
}
