import { Diagnostic, DiagnosticSeverity } from "vscode";
import {
    DictionaryBlockField,
    RequestFileBlock,
    castBlockToDictionaryBlock,
    MetaBlockKey,
} from "../../../../../shared";
import { DiagnosticCode } from "../../diagnosticCodeEnum";
import { getFieldFromDictionaryBlock } from "../../util/getFieldFromDictionaryBlock";

export function checkSequenceInMetaBlockIsNumeric(
    metaBlock: RequestFileBlock
): Diagnostic | DiagnosticCode {
    const castedMetaBlock = castBlockToDictionaryBlock(metaBlock);

    if (!castedMetaBlock) {
        return DiagnosticCode.SequenceNotNumeric;
    }

    const sequenceField = getFieldFromDictionaryBlock(
        castedMetaBlock,
        MetaBlockKey.Sequence
    );

    if (sequenceField && Number.isNaN(Number(sequenceField.value))) {
        return getDiagnostic(sequenceField);
    } else {
        return DiagnosticCode.SequenceNotNumeric;
    }
}

function getDiagnostic(sequenceField: DictionaryBlockField) {
    return {
        message: "Sequence is not numeric",
        range: sequenceField.valueRange,
        severity: DiagnosticSeverity.Error,
        code: DiagnosticCode.SequenceNotNumeric,
    };
}
