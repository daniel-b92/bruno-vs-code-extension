import { basename, extname } from "path";
import { Range } from "@global_shared";
import { DiagnosticSeverity } from "vscode-languageserver";
import { DiagnosticWithCode } from "../../../bruFiles/diagnostics/interfaces";
import { RelevantWithinEnvironmentFileDiagnosticCode } from "../../../bruFiles/diagnostics/shared/diagnosticCodes/relevantWithinEnvironmentFileDiagnosticCodeEnum";

export interface ExtendsFieldWithValueRange {
    value: string;
    valueRange: Range;
}

export function checkExtendsFieldIsValid(
    filePath: string,
    extendsField: ExtendsFieldWithValueRange,
    knownEnvironmentNames?: string[],
): DiagnosticWithCode | undefined {
    const { value, valueRange } = extendsField;
    const ownEnvironmentName = basename(filePath, extname(filePath));

    if (value.trim().length == 0) {
        return getDiagnostic(
            valueRange,
            "The 'extends' field must reference the name of another environment.",
        );
    }

    if (value == ownEnvironmentName) {
        return getDiagnostic(
            valueRange,
            `Environment '${value}' cannot extend itself.`,
        );
    }

    if (
        knownEnvironmentNames != undefined &&
        !knownEnvironmentNames.includes(value)
    ) {
        return getDiagnostic(
            valueRange,
            `Environment '${value}' referenced by 'extends' does not exist in this collection.`,
        );
    }

    return undefined;
}

function getDiagnostic(range: Range, message: string): DiagnosticWithCode {
    return {
        message,
        range,
        severity: DiagnosticSeverity.Error,
        code: RelevantWithinEnvironmentFileDiagnosticCode.InvalidExtendsField,
    };
}
