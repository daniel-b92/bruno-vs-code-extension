import {
    excludeTrailingWhitespace,
    TextDocumentHelper,
    WithKeyAndValueRange,
} from "@global_shared";
import { basename } from "path";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { TypedCollectionItemProvider } from "../../../../shared/interfaces";
import { getSequencesForOtherFoldersWithSameParent } from "../../../../shared/diagnostics/relatedFiles/getSequencesForOtherFoldersWithSameParent";
import { getRelatedInformationForSequences } from "../../shared/getRelatedInformationForSequences";

export function checkFolderSequenceIsUnique(
    sequence: WithKeyAndValueRange<number> | undefined,
    docHelper: TextDocumentHelper,
    folderSettingsPath: string,
    itemProvider: TypedCollectionItemProvider,
): Diagnostic | undefined {
    if (!sequence) {
        return undefined;
    }

    const otherFiles = getSequencesForOtherFoldersWithSameParent(
        itemProvider,
        folderSettingsPath,
    )
        .filter(
            ({ sequence: otherSequence }) => otherSequence == sequence.value,
        )
        .map(({ folderSettingsFile, folderPath }) => ({
            path: folderSettingsFile,
            message: `Folder '${basename(folderPath)}' with same sequence`,
        }));

    if (otherFiles.length == 0) {
        return undefined;
    }

    return {
        message:
            "Other folders with the same sequence already exist for the same parent folder.",
        range: excludeTrailingWhitespace(sequence.valueRange, docHelper),
        severity: DiagnosticSeverity.Error,
        relatedInformation: getRelatedInformationForSequences(otherFiles),
    };
}
