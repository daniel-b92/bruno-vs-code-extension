import { Diagnostic, DiagnosticSeverity, Range } from "vscode";
import { DictionaryBlockField, RequestFileBlock } from "../../../../../shared";
import { DiagnosticCode } from "../../diagnosticCodeEnum";
import { castBlockToDictionaryBlock } from "../../../../../shared/fileSystem/testFileParsing/internal/castBlockToDictionaryBlock";
import { MetaBlockKey } from "../../../../../shared/fileSystem/testFileParsing/definitions/metaBlockKeyEnum";
import { getUnknownKeysFromDictionaryBlock } from "../../util/getUnknownKeysFromDictionaryBlock";
import { getSortedDictionaryBlockFieldsByPosition } from "../../util/getSortedDictionaryBlockFieldsByPosition";

export function checkNoUnknownKeysAreDefinedInMetaBlock(
    metaBlock: RequestFileBlock
): Diagnostic | DiagnosticCode {
    const castedMetaBlock = castBlockToDictionaryBlock(metaBlock);

    if (!castedMetaBlock) {
        return DiagnosticCode.UnknownKeysDefinedInMetaBlock;
    }

    const sortedUnknownKeys = getUnknownKeysFromDictionaryBlock(
        castedMetaBlock,
        Object.values(MetaBlockKey)
    );

    if (sortedUnknownKeys.length > 0) {
        return getDiagnostic(sortedUnknownKeys);
    } else {
        return DiagnosticCode.UnknownKeysDefinedInMetaBlock;
    }
}

function getDiagnostic(unknownFields: DictionaryBlockField[]) {
    const sortedFields =
        getSortedDictionaryBlockFieldsByPosition(unknownFields);

    return {
        message:
            sortedFields.length == 1
                ? `Unknown key '${sortedFields[0].key}'.`
                : `Unknown keys are defined: '${sortedFields
                      .map(({ key }) => key)
                      .join("', '")}'.`,
        range: getRange(sortedFields),
        severity: DiagnosticSeverity.Error,
        code: DiagnosticCode.UnknownKeysDefinedInMetaBlock,
    };
}

function getRange(sortedUnknownFields: DictionaryBlockField[]): Range {
    return new Range(
        sortedUnknownFields[0].keyRange.start,
        sortedUnknownFields[sortedUnknownFields.length - 1].keyRange.end
    );
}
