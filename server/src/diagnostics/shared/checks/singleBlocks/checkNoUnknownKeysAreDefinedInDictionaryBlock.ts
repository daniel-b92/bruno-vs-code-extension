import { DiagnosticSeverity, Range } from "vscode";
import {
    DictionaryBlockField,
    DictionaryBlock,
    mapPosition,
} from "../../../../../../shared";
import { KnownDiagnosticCode } from "../../diagnosticCodes/knownDiagnosticCodeDefinition";
import { getUnknownKeysFromDictionaryBlock } from "../../util/getUnknownKeysFromDictionaryBlock";
import { getSortedDictionaryBlockFieldsByPosition } from "../../util/getSortedDictionaryBlockFieldsByPosition";
import { DiagnosticWithCode } from "../../../definitions";

export function checkNoUnknownKeysAreDefinedInDictionaryBlock(
    block: DictionaryBlock,
    expectedKeys: string[],
    diagnosticCode: KnownDiagnosticCode,
): DiagnosticWithCode | undefined {
    const unknownKeys = getUnknownKeysFromDictionaryBlock(block, expectedKeys);

    if (unknownKeys.length > 0) {
        return getDiagnostic(unknownKeys, diagnosticCode, expectedKeys);
    } else {
        return undefined;
    }
}

function getDiagnostic(
    unknownFields: DictionaryBlockField[],
    diagnosticCode: KnownDiagnosticCode,
    expectedKeys: string[],
) {
    const sortedFields =
        getSortedDictionaryBlockFieldsByPosition(unknownFields);

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

function getRange(sortedUnknownFields: DictionaryBlockField[]): Range {
    return new Range(
        mapPosition(sortedUnknownFields[0].keyRange.start),
        mapPosition(
            sortedUnknownFields[sortedUnknownFields.length - 1].keyRange.end,
        ),
    );
}
