import { DiagnosticSeverity, Uri } from "vscode";
import { DictionaryBlock } from "@global_shared";
import { mapToVsCodeRange } from "@shared";
import { getSortedDictionaryBlockFieldsByPosition } from "../../util/getSortedDictionaryBlockFieldsByPosition";
import {
    FieldsWithSameKey,
    getValidDuplicateKeysFromDictionaryBlock,
} from "../../util/getValidDuplicateKeysFromDictionaryBlock";
import { DiagnosticWithCode } from "../../../interfaces";
import { KnownDiagnosticCode } from "../../diagnosticCodes/knownDiagnosticCodeDefinition";

export function checkNoDuplicateKeysAreDefinedForDictionaryBlock(
    documentUri: Uri,
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

    return getDiagnostics(documentUri, fieldsWithDuplicateKeys, diagnosticCode);
}

function getDiagnostics(
    documentUri: Uri,
    fieldsWithDuplicateKeys: FieldsWithSameKey[],
    diagnosticCode: KnownDiagnosticCode,
) {
    return fieldsWithDuplicateKeys.map(({ key, fields }) => {
        const sortedFieldsByPosition =
            getSortedDictionaryBlockFieldsByPosition(fields);

        return {
            message: `Key '${key}' is defined ${fields.length} times`,
            range: mapToVsCodeRange(
                sortedFieldsByPosition[sortedFieldsByPosition.length - 1]
                    .keyRange,
            ),
            severity: DiagnosticSeverity.Error,
            code: diagnosticCode,
            relatedInformation: sortedFieldsByPosition
                .slice(0, -1)
                .map(({ keyRange }) => ({
                    message: `Previous definition for key '${key}'`,
                    location: {
                        uri: documentUri,
                        range: mapToVsCodeRange(keyRange),
                    },
                })),
        };
    });
}
