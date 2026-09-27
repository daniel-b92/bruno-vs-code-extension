import { basename } from "path";
import {
    EnvironmentFileExtendsField,
    getExtensionForBrunoFiles,
} from "@global_shared";
import { DiagnosticSeverity } from "vscode-languageserver";
import { DiagnosticWithCode } from "../interfaces";
import { RelevantWithinEnvironmentFileDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinEnvironmentFileDiagnosticCodeEnum";

export function checkExtendsFieldIsValid(
    filePath: string,
    extendsField: EnvironmentFileExtendsField,
    knownEnvironmentNames?: string[],
): DiagnosticWithCode | undefined {
    const { value, valueRange } = extendsField;
    const ownEnvironmentName = basename(filePath, getExtensionForBrunoFiles());

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

function getDiagnostic(
    range: EnvironmentFileExtendsField["valueRange"],
    message: string,
): DiagnosticWithCode {
    return {
        message,
        range,
        severity: DiagnosticSeverity.Error,
        code: RelevantWithinEnvironmentFileDiagnosticCode.InvalidExtendsField,
    };
}
