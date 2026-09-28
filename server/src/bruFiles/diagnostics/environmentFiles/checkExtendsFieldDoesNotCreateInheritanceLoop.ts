import { basename } from "path";
import {
    EnvironmentFileExtendsField,
    getExtensionForBrunoFiles,
} from "@global_shared";
import { DiagnosticSeverity } from "vscode-languageserver";
import { TypedCollection } from "../../../shared";
import { DiagnosticWithCode } from "../interfaces";
import { RelevantWithinEnvironmentFileDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinEnvironmentFileDiagnosticCodeEnum";

export function checkExtendsFieldDoesNotCreateInheritanceLoop(
    filePath: string,
    extendsField: EnvironmentFileExtendsField,
    collection: TypedCollection,
): DiagnosticWithCode | undefined {
    const { value, valueRange } = extendsField;
    const ownEnvironmentName = basename(filePath, getExtensionForBrunoFiles());

    if (value.trim().length == 0 || value == ownEnvironmentName) {
        return undefined;
    }

    const inheritanceChainOfExtendedEnvironment =
        collection.getEnvironmentInheritanceChain(value);

    if (!inheritanceChainOfExtendedEnvironment.includes(ownEnvironmentName)) {
        return undefined;
    }

    return {
        message: `Environment '${value}' cannot be referenced here, because it (directly or indirectly) already extends '${ownEnvironmentName}'. This would create an endless loop of extended environments.`,
        range: valueRange,
        severity: DiagnosticSeverity.Error,
        code: RelevantWithinEnvironmentFileDiagnosticCode.ExtendsFieldWouldCreateInheritanceLoop,
    };
}
