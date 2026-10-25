import * as ts from "typescript/lib/tsserverlibrary";

export function findDeepestNodeContainingPosition(
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
