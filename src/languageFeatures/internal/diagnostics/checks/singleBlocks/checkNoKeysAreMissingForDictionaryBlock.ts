import { Diagnostic, DiagnosticSeverity } from "vscode";
import { DictionaryBlock } from "../../../../../shared";
import { DiagnosticCode } from "../../diagnosticCodeEnum";
import { getMissingKeysForDictionaryBlock } from "../../util/getMissingKeysForDictionaryBlock";

export function checkNoKeysAreMissingForDictionaryBlock(
    block: DictionaryBlock,
    expectedKeys: string[],
    diagnosticCode: DiagnosticCode
): Diagnostic | DiagnosticCode {
    const missingKeys = getMissingKeysForDictionaryBlock(block, expectedKeys);

    if (missingKeys.length > 0) {
        return getDiagnostic(block, missingKeys, diagnosticCode);
    } else {
        return diagnosticCode;
    }
}

function getDiagnostic(
    block: DictionaryBlock,
    missingFields: string[],
    diagnosticCode: DiagnosticCode
) {
    return {
        message:
            missingFields.length == 1
                ? `Mandatory key '${missingFields[0]}' is missing.`
                : `Mandatory keys '${missingFields.join("', '")}' are missing.`,
        range: block.contentRange,
        severity: DiagnosticSeverity.Error,
        code: diagnosticCode,
    };
}
