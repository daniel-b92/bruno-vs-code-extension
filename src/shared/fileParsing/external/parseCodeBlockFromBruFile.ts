import { SyntaxKind } from "typescript";
import { TextDocumentHelper } from "../..";
import { parseCodeBlock } from "./parseCodeBlock";

export function parseCodeBlockFromBruFile(
    document: TextDocumentHelper,
    firstContentLine: number,
) {
    return parseCodeBlock(document, firstContentLine, SyntaxKind.Block);
}
