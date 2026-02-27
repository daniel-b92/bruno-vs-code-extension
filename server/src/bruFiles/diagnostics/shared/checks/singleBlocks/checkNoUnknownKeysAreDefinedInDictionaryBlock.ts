import {
    DictionaryBlockSimpleField,
    DictionaryBlock,
    DictionaryBlockArrayField,
    Range,
} from "@global_shared";
import { KnownDiagnosticCode } from "../../diagnosticCodes/knownDiagnosticCodeDefinition";
import { getSortedDictionaryBlockFieldsByPosition } from "../../util/getSortedDictionaryBlockFieldsByPosition";
import { DiagnosticWithCode } from "../../../interfaces";
import { DiagnosticSeverity } from "vscode-languageserver";

export function checkNoUnknownKeysAreDefinedInDictionaryBlock(
    block: DictionaryBlock,
    expectedKeys: string[],
    diagnosticCode: KnownDiagnosticCode,
): DiagnosticWithCode | undefined {
    const fieldsWithUnknownKeys = getFieldsWithUnknownKeys(block, expectedKeys);

    if (fieldsWithUnknownKeys.length > 0) {
        return getDiagnostic(
            fieldsWithUnknownKeys,
            diagnosticCode,
            expectedKeys,
        );
    } else {
        return undefined;
    }
}

function getDiagnostic(
    fieldsWithUnknownKeys: (
        | DictionaryBlockSimpleField
        | DictionaryBlockArrayField
    )[],
    diagnosticCode: KnownDiagnosticCode,
    expectedKeys: string[],
) {
    const sortedFields = getSortedDictionaryBlockFieldsByPosition(
        fieldsWithUnknownKeys,
    );

    return {
        message: `${
            sortedFields.length == 1
                ? `Unknown key '${sortedFields[0].key}'.`
                : `Unknown keys are defined: '${sortedFields
                      .map(({ key }) => key)
                      .join("', '")}'.`
        } Allowed keys are ${JSON.stringify(expectedKeys, null, 2)}.`,
        range: getRange(sortedFields),
        severity: DiagnosticSeverity.Error,
        code: diagnosticCode,
    };
}

function getRange(
    sortedUnknownFields: (
        | DictionaryBlockSimpleField
        | DictionaryBlockArrayField
    )[],
): Range {
    return new Range(
        sortedUnknownFields[0].keyRange.start,
        sortedUnknownFields[sortedUnknownFields.length - 1].keyRange.end,
    );
}

function getFieldsWithUnknownKeys(
    block: DictionaryBlock,
    allExpectedKeys: string[],
) {
    return block.content.filter(
        ({ key, disabled }) => !disabled && !allExpectedKeys.includes(key),
    );
}
