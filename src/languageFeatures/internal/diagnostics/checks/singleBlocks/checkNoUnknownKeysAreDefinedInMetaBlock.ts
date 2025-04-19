import { Diagnostic, DiagnosticSeverity, Range } from "vscode";
import { DictionaryBlockField, RequestFileBlock } from "../../../../../shared";
import { DiagnosticCode } from "../../diagnosticCodeEnum";
import { castBlockToDictionaryBlock } from "../../../../../shared/fileSystem/testFileParsing/internal/castBlockToDictionaryBlock";
import { MetaBlockFieldName } from "../../../../../shared/fileSystem/testFileParsing/definitions/metaBlockFieldNameEnum";
import { getUnknownKeysFromDictionaryBlock } from "../../util/getUnknownKeysFromDictionaryBlock";
import { getSortedBlocksOrFieldsByPosition } from "../../util/getSortedBlocksOrFieldsByPosition";

export function checkNoUnknownKeysAreDefinedInMetaBlock(
    metaBlock: RequestFileBlock
): Diagnostic | DiagnosticCode {
    const castedMetaBlock = castBlockToDictionaryBlock(metaBlock);

    if (!castedMetaBlock) {
        return DiagnosticCode.UnknownKeysDefinedInMetaBlock;
    }

    const sortedUnknownKeys = getUnknownKeysFromDictionaryBlock(
        castedMetaBlock,
        Object.values(MetaBlockFieldName)
    );

    if (sortedUnknownKeys.length > 0) {
        return getDiagnostic(sortedUnknownKeys);
    } else {
        return DiagnosticCode.UnknownKeysDefinedInMetaBlock;
    }
}

function getDiagnostic(unknownFields: DictionaryBlockField[]) {
    const sortedFields = getSortedBlocksOrFieldsByPosition(
        unknownFields
    ) as DictionaryBlockField[];

    return {
        message:
            sortedFields.length == 1
                ? `Unknown key with name '${sortedFields[0].name}'.`
                : `Unknown keys are defined: '${sortedFields
                      .map(({ name }) => name)
                      .join("', '")}'.`,
        range: getRange(sortedFields),
        severity: DiagnosticSeverity.Error,
        code: DiagnosticCode.UnknownKeysDefinedInMetaBlock,
    };
}

function getRange(sortedUnknownFields: DictionaryBlockField[]): Range {
    return new Range(
        sortedUnknownFields[0].nameRange.start,
        sortedUnknownFields[sortedUnknownFields.length - 1].nameRange.end
    );
}
