import {
    Block,
    BrunoFileType,
    getActiveFieldFromMetaBlock,
    isDictionaryBlockSimpleField,
    MetaBlockKey,
} from "@global_shared";
import { TypedCollectionItemProvider } from "../../../../../shared";
import { getSequenceClashWithAppFilesDiagnostic } from "../../../../../shared/diagnostics/relatedFiles/getSequenceClashWithAppFilesDiagnostic";
import { DiagnosticWithCode } from "../../../interfaces";
import { RelevantWithinMetaBlockDiagnosticCode } from "../../diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { doesDictionaryBlockFieldHaveValidIntegerValue } from "../../util/doesDictionaryBlockFieldHaveValidIntegerValue";

export function checkSequenceDoesNotClashWithAppFiles(data: {
    metaBlock: Block;
    filePath: string;
    fileType: BrunoFileType.RequestFile | BrunoFileType.AppFile;
    itemProvider: TypedCollectionItemProvider;
}): DiagnosticWithCode | undefined {
    const { metaBlock, filePath, fileType, itemProvider } = data;
    const sequenceField = getActiveFieldFromMetaBlock(
        metaBlock,
        MetaBlockKey.Sequence,
    );

    if (
        !sequenceField ||
        !isDictionaryBlockSimpleField(sequenceField) ||
        !doesDictionaryBlockFieldHaveValidIntegerValue(sequenceField, 1)
    ) {
        return undefined;
    }

    const diagnostic = getSequenceClashWithAppFilesDiagnostic({
        sequence: Number.parseInt(sequenceField.value),
        sequenceRange: sequenceField.valueRange,
        filePath,
        fileType,
        itemProvider,
    });

    return diagnostic
        ? {
              ...diagnostic,
              code: RelevantWithinMetaBlockDiagnosticCode.SequenceClashesWithAppFileInFolder,
          }
        : undefined;
}
