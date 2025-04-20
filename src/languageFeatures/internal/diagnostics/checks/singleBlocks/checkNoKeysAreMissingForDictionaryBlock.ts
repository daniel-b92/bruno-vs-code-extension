import { DiagnosticSeverity } from "vscode";
import { DictionaryBlock } from "../../../../../shared";
import { getMissingKeysForDictionaryBlock } from "../../util/getMissingKeysForDictionaryBlock";
import { DiagnosticWithCode } from "../../definitions";
import { KnownDiagnosticCode } from "../../diagnosticCodes/knownDiagnosticCodeEnum";

export function checkNoKeysAreMissingForDictionaryBlock(
    block: DictionaryBlock,
    expectedKeys: string[],
    diagnosticCode: KnownDiagnosticCode
): DiagnosticWithCode | KnownDiagnosticCode {
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
    diagnosticCode: KnownDiagnosticCode
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
