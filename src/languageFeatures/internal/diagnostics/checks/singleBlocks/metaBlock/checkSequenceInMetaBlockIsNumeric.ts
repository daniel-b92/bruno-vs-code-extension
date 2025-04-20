import { DiagnosticSeverity } from "vscode";
import {
    DictionaryBlockField,
    RequestFileBlock,
    castBlockToDictionaryBlock,
    MetaBlockKey,
} from "../../../../../../shared";
import { getFieldFromDictionaryBlock } from "../../../util/getFieldFromDictionaryBlock";
import { DiagnosticWithCode } from "../../../definitions";
import { MetaBlockSpecificDiagnosticCode } from "../../../diagnosticCodes/metaBlockSpecificDiagnosticCodeEnum";

export function checkSequenceInMetaBlockIsNumeric(
    metaBlock: RequestFileBlock
): DiagnosticWithCode | MetaBlockSpecificDiagnosticCode {
    const castedMetaBlock = castBlockToDictionaryBlock(metaBlock);

    if (!castedMetaBlock) {
        return getCode();
    }

    const sequenceField = getFieldFromDictionaryBlock(
        castedMetaBlock,
        MetaBlockKey.Sequence
    );

    if (sequenceField && Number.isNaN(Number(sequenceField.value))) {
        return getDiagnostic(sequenceField);
    } else {
        return getCode();
    }
}

function getDiagnostic(sequenceField: DictionaryBlockField) {
    return {
        message: "Sequence is not numeric",
        range: sequenceField.valueRange,
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getCode() {
    return MetaBlockSpecificDiagnosticCode.SequenceNotNumeric;
}
