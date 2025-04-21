import { DiagnosticSeverity } from "vscode";
import {
    DictionaryBlockField,
    RequestFileBlock,
    castBlockToDictionaryBlock,
    MetaBlockKey,
} from "../../../../../../shared";
import { getFieldFromDictionaryBlock } from "../../../util/getFieldFromDictionaryBlock";
import { DiagnosticWithCode } from "../../../definitions";
import { RelevantWithinMetaBlockDiagnosticCode } from "../../../diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";

export function checkSequenceInMetaBlockIsNumeric(
    metaBlock: RequestFileBlock
): DiagnosticWithCode | undefined {
    const castedMetaBlock = castBlockToDictionaryBlock(metaBlock);

    if (!castedMetaBlock) {
        return undefined;
    }

    const sequenceField = getFieldFromDictionaryBlock(
        castedMetaBlock,
        MetaBlockKey.Sequence
    );

    if (sequenceField && Number.isNaN(Number(sequenceField.value))) {
        return getDiagnostic(sequenceField);
    } else {
        return undefined;
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
    return RelevantWithinMetaBlockDiagnosticCode.SequenceNotNumeric;
}
