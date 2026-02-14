import { DiagnosticSeverity, Range as VsCodeRange } from "vscode";
import {
    DictionaryBlockSimpleField,
    DictionaryBlock,
    DictionaryBlockArrayField,
} from "@global_shared";
import { mapToVsCodePosition } from "@shared";
import { KnownDiagnosticCode } from "../../diagnosticCodes/knownDiagnosticCodeDefinition";
import { getSortedDictionaryBlockFieldsByPosition } from "../../util/getSortedDictionaryBlockFieldsByPosition";
import { DiagnosticWithCode } from "../../../interfaces";

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
): VsCodeRange {
    return new VsCodeRange(
        mapToVsCodePosition(sortedUnknownFields[0].keyRange.start),
        mapToVsCodePosition(
            sortedUnknownFields[sortedUnknownFields.length - 1].keyRange.end,
        ),
    );
}

function getFieldsWithUnknownKeys(
    block: DictionaryBlock,
    allExpectedKeys: string[],
) {
    return block.content.filter(({ key }) => !allExpectedKeys.includes(key));
}
