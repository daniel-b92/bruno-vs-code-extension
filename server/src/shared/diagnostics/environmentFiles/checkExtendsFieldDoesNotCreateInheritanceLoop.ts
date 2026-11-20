import { basename, extname } from "path";
import { DiagnosticSeverity } from "vscode-languageserver";
import { TypedCollection } from "../../interfaces";
import { ExtendsFieldWithValueRange } from "./checkExtendsFieldIsValid";
import { DiagnosticWithCode } from "../../../bruFiles/diagnostics/interfaces";
import { RelevantWithinEnvironmentFileDiagnosticCode } from "../../../bruFiles/diagnostics/shared/diagnosticCodes/relevantWithinEnvironmentFileDiagnosticCodeEnum";

export function checkExtendsFieldDoesNotCreateInheritanceLoop(
    filePath: string,
    extendsField: ExtendsFieldWithValueRange,
    collection: TypedCollection,
): DiagnosticWithCode | undefined {
    const { value, valueRange } = extendsField;
    const ownEnvironmentName = basename(filePath, extname(filePath));

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
