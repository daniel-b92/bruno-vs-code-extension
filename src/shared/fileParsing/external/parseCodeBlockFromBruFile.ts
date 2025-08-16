import { Node, SyntaxKind, SourceFile } from "typescript";
import { TextDocumentHelper } from "../..";
import { parseCodeBlock } from "./parseCodeBlock";

export function parseCodeBlockFromBruFile(
    document: TextDocumentHelper,
    firstContentLine: number,
) {
    return parseCodeBlock(
        document,
        firstContentLine,
        (sourceFile: SourceFile) =>
            (sourceFile as Node)
                .getChildAt(0, sourceFile)
                .getChildren(sourceFile)
                .find(({ kind }) => kind == SyntaxKind.Block),
    );
}
