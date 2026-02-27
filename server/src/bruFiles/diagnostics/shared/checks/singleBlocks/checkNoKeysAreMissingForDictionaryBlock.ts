import { DictionaryBlock } from "@global_shared";
import { DiagnosticWithCode } from "../../../interfaces";
import { KnownDiagnosticCode } from "../../diagnosticCodes/knownDiagnosticCodeDefinition";
import { DiagnosticSeverity } from "vscode-languageserver";

export function checkNoKeysAreMissingForDictionaryBlock(
    block: DictionaryBlock,
    expectedKeys: string[],
    diagnosticCode: KnownDiagnosticCode,
): DiagnosticWithCode | undefined {
    const missingKeys = getMissingKeysForDictionaryBlock(block, expectedKeys);

    if (missingKeys.length > 0) {
        return getDiagnostic(block, missingKeys, diagnosticCode);
    } else {
        return undefined;
    }
}

function getDiagnostic(
    block: DictionaryBlock,
    missingFields: string[],
    diagnosticCode: KnownDiagnosticCode,
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

function getMissingKeysForDictionaryBlock(
    block: DictionaryBlock,
    allExpectedKeys: string[],
) {
    return allExpectedKeys.filter(
        (expectedKey) =>
            !block.content.some(
                ({ key, disabled }) => expectedKey == key && !disabled,
            ),
    );
}
