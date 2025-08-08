import { DiagnosticSeverity } from "vscode";
import {
    DictionaryBlockField,
    Block,
    MetaBlockKey,
    getFieldFromMetaBlock,
    mapRange,
} from "../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { isSequenceValid } from "../../util/isSequenceValid";
import { RelevantWithinMetaBlockDiagnosticCode } from "../../diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";

export function checkSequenceInMetaBlockIsValid(
    metaBlock: Block
): DiagnosticWithCode | undefined {
    const sequenceField = getFieldFromMetaBlock(
        metaBlock,
        MetaBlockKey.Sequence
    );

    if (sequenceField && !isSequenceValid(sequenceField)) {
        return getDiagnostic(sequenceField);
    } else {
        return undefined;
    }
}

function getDiagnostic(sequenceField: DictionaryBlockField) {
    return {
        message:
            "Sequence is not valid. It needs to be an integer with a value of at least 1.",
        range: mapRange(sequenceField.valueRange),
        severity: DiagnosticSeverity.Error,
        code: RelevantWithinMetaBlockDiagnosticCode.SequenceNotValid,
    };
}
