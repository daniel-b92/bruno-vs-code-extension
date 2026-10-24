import * as ts from "typescript/lib/tsserverlibrary";
import { getNamesForInbuiltFunctionsWithVariableName } from "../constants";
import { findStringLiteralAtPosition } from "./findStringLiteralAtPosition";

/**
 * Whether the position is within the name of a variable, that is passed to an inbuilt function (e.g. `bru.getEnvVar("name")`).
 * The extension provides hovers and completions for these names itself, so they should not be provided by the Typescript server as well.
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

    const node = findStringLiteralAtPosition(sourceFile, position);

    return node != undefined && isFirstParameterOfInbuiltFunction(node);
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
