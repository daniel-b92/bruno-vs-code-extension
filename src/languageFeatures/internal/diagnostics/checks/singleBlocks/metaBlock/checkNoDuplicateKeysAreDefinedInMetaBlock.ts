import { Diagnostic, DiagnosticSeverity, Range } from "vscode";
import {
    DictionaryBlockField,
    RequestFileBlock,
    castBlockToDictionaryBlock,
    MetaBlockKey,
} from "../../../../../../shared";
import { DiagnosticCode } from "../../../diagnosticCodeEnum";
import { getSortedDictionaryBlockFieldsByPosition } from "../../../util/getSortedDictionaryBlockFieldsByPosition";
import {
    FieldsWithSameKey,
    getValidDuplicateKeysFromDictionaryBlock,
} from "../../../util/getValidDuplicateKeysFromDictionaryBlock";

export function checkNoDuplicateKeysAreDefinedInMetaBlock(
    metaBlock: RequestFileBlock
): Diagnostic | DiagnosticCode {
    const castedMetaBlock = castBlockToDictionaryBlock(metaBlock);

    if (!castedMetaBlock) {
        return DiagnosticCode.DuplicateKeysDefinedInMetaBlock;
    }

    const fieldsWithDuplicateKeys = getValidDuplicateKeysFromDictionaryBlock(
        castedMetaBlock,
        Object.values(MetaBlockKey)
    );

    if (fieldsWithDuplicateKeys.length > 0) {
        return getDiagnostic(fieldsWithDuplicateKeys);
    } else {
        return DiagnosticCode.DuplicateKeysDefinedInMetaBlock;
    }
}

function getDiagnostic(fieldsWithDuplicateKeys: FieldsWithSameKey[]) {
    const sortedFieldsByPosition = getSortedDictionaryBlockFieldsByPosition(
        fieldsWithDuplicateKeys.map(({ fields }) => fields).flat()
    );

    return {
        message: `Some keys are defined multiple times: '${fieldsWithDuplicateKeys
            .map(({ key }) => key)
            .join("', '")}'.`,
        range: getRange(sortedFieldsByPosition),
        severity: DiagnosticSeverity.Error,
        code: DiagnosticCode.DuplicateKeysDefinedInMetaBlock,
    };
}

function getRange(sortedUnknownFields: DictionaryBlockField[]): Range {
    return new Range(
        sortedUnknownFields[0].keyRange.start,
        sortedUnknownFields[sortedUnknownFields.length - 1].keyRange.end
    );
}
