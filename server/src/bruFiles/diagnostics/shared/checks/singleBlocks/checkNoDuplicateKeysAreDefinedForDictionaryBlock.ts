import { DictionaryBlock } from "@global_shared";
import { getSortedDictionaryBlockFieldsByPosition } from "../../util/getSortedDictionaryBlockFieldsByPosition";
import {
    FieldsWithSameKey,
    getValidDuplicateKeysFromDictionaryBlock,
} from "../../util/getValidDuplicateKeysFromDictionaryBlock";
import { DiagnosticWithCode } from "../../../interfaces";
import { KnownDiagnosticCode } from "../../diagnosticCodes/knownDiagnosticCodeDefinition";
import { DiagnosticSeverity } from "vscode-languageserver";
import { URI } from "vscode-uri";

export function checkNoDuplicateKeysAreDefinedForDictionaryBlock(
    filePath: string,
    block: DictionaryBlock,
    diagnosticCode: KnownDiagnosticCode,
    expectedKeys?: string[],
): DiagnosticWithCode[] | undefined {
    const fieldsWithDuplicateKeys = getValidDuplicateKeysFromDictionaryBlock(
        block,
        expectedKeys,
    );

    if (fieldsWithDuplicateKeys.length == 0) {
        return undefined;
    }

    return getDiagnostics(filePath, fieldsWithDuplicateKeys, diagnosticCode);
}

function getDiagnostics(
    filePath: string,
    fieldsWithDuplicateKeys: FieldsWithSameKey[],
    diagnosticCode: KnownDiagnosticCode,
) {
    return fieldsWithDuplicateKeys.map(({ key, fields }) => {
        const sortedFieldsByPosition =
            getSortedDictionaryBlockFieldsByPosition(fields);

        return {
            message: `Key '${key}' is defined ${fields.length} times`,
            range: sortedFieldsByPosition[sortedFieldsByPosition.length - 1]
                .keyRange,
            severity: DiagnosticSeverity.Error,
            code: diagnosticCode,
            relatedInformation: sortedFieldsByPosition
                .slice(0, -1)
                .map(({ keyRange }) => ({
                    message: `Previous definition for key '${key}'`,
                    location: {
                        uri: URI.file(filePath).toString(),
                        range: keyRange,
                    },
                })),
        };
    });
}
