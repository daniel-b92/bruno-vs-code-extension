import {
    BrunoFileType,
    excludeTrailingWhitespace,
    TextDocumentHelper,
    WithKeyAndValueRange,
} from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { TypedCollectionItemProvider } from "../../../../shared/interfaces";
import { getSequencesForOtherFilesInFolder } from "../../../../shared/diagnostics/relatedFiles/getSequencesForOtherFilesInFolder";
import { getRelatedInformationForSequences } from "../../../../shared/diagnostics/relatedFiles/getRelatedInformationForSequences";

export function checkSequenceIsUniqueWithinFolder(
    sequence: WithKeyAndValueRange<number> | undefined,
    docHelper: TextDocumentHelper,
    filePath: string,
    itemProvider: TypedCollectionItemProvider,
): Diagnostic | undefined {
    if (!sequence) {
        return undefined;
    }

    const otherFiles = getSequencesForOtherFilesInFolder(
        itemProvider,
        filePath,
        [BrunoFileType.RequestFile],
    )
        .filter(
            ({ sequence: otherSequence }) => otherSequence == sequence.value,
        )
        .map(({ file }) => ({
            path: file,
            message: "Request with same sequence",
        }));

    if (otherFiles.length == 0) {
        return undefined;
    }

    return {
        message:
            "Other requests with the same sequence already exists within this folder.",
        range: excludeTrailingWhitespace(sequence.valueRange, docHelper),
        severity: DiagnosticSeverity.Error,
        relatedInformation: getRelatedInformationForSequences(otherFiles),
    };
}
