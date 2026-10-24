import * as ts from "typescript/lib/tsserverlibrary";

/**
 * Returns the string literal, if the position is within its content.
 * Positions directly in front of the opening quote and behind the closing quote are not within the content.
 */
export function findStringLiteralAtPosition(
    sourceFile: ts.SourceFile,
    position: number,
) {
    const node = findDeepestNodeContainingPosition(sourceFile, position);

    if (
        !node ||
        !(ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ) {
        return undefined;
    }

    const start = node.getStart(sourceFile);
    const end = node.getEnd();
    const text = node.getText(sourceFile);
    // While typing, the string may not be closed yet.
    const isClosed = text.length > 1 && text.endsWith(text[0]);

    return start < position && (isClosed ? position < end : position <= end)
        ? node
        : undefined;
}

function findDeepestNodeContainingPosition(
    sourceFile: ts.SourceFile,
    position: number,
) {
    let current: ts.Node = sourceFile;
    let child: ts.Node | undefined;

    do {
        child = ts.forEachChild(current, (candidate) =>
            candidate.getStart(sourceFile) <= position &&
            position <= candidate.getEnd()
                ? candidate
                : undefined,
        );
        current = child ?? current;
    } while (child);

    return current === sourceFile ? undefined : current;
}
