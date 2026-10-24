import * as ts from "typescript/lib/tsserverlibrary";
import { getNamesForInbuiltFunctionsWithVariableName } from "../constants";

/**
 * Whether the position is within the name of a variable, that is passed to an inbuilt function (e.g. `bru.getEnvVar("name")`).
 * The extension provides hovers and completions for these names itself, so they should not be provided by the Typescript server as well.
 *
 * Positions directly in front of the opening quote and behind the closing quote are not within the name.
 */
export function isPositionWithinNameOfVariable(
    info: ts.server.PluginCreateInfo,
    fileName: string,
    position: number,
) {
    const sourceFile = info.languageService
        .getProgram()
        ?.getSourceFile(fileName);

    if (!sourceFile) {
        return false;
    }

    const node = findDeepestNodeContainingPosition(sourceFile, position);

    if (
        !node ||
        !(
            ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
        ) ||
        !isFirstParameterOfInbuiltFunction(node)
    ) {
        return false;
    }

    const start = node.getStart(sourceFile);
    const end = node.getEnd();
    const text = node.getText(sourceFile);
    // While typing, the string may not be closed yet.
    const isClosed = text.length > 1 && text.endsWith(text[0]);

    return start < position && (isClosed ? position < end : position <= end);
}

function isFirstParameterOfInbuiltFunction(node: ts.Node) {
    const { parent } = node;

    return (
        ts.isCallExpression(parent) &&
        parent.arguments[0] === node &&
        ts.isPropertyAccessExpression(parent.expression) &&
        ts.isIdentifier(parent.expression.expression) &&
        parent.expression.expression.text == "bru" &&
        getNamesForInbuiltFunctionsWithVariableName().includes(
            parent.expression.name.text,
        )
    );
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
