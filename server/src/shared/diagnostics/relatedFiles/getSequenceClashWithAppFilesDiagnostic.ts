import { BrunoFileType, Range } from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { TypedCollectionItemProvider } from "../../interfaces";
import { getSequencesForOtherFilesInFolder } from "./getSequencesForOtherFilesInFolder";
import { getRelatedInformationForSequences } from "./getRelatedInformationForSequences";

/**
 * Checks whether an app file shares its sequence with another app file or a request file in the same folder (or whether a request file shares it with an app file).
 * Clashes between two request files are reported separately and not handled here.
 */
export function getSequenceClashWithAppFilesDiagnostic(data: {
    sequence: number;
    sequenceRange: Range;
    filePath: string;
    fileType: BrunoFileType.RequestFile | BrunoFileType.AppFile;
    itemProvider: TypedCollectionItemProvider;
}): Diagnostic | undefined {
    const { sequence, sequenceRange, filePath, fileType, itemProvider } = data;

    const filesWithSameSequence = getSequencesForOtherFilesInFolder(
        itemProvider,
        filePath,
        fileType == BrunoFileType.AppFile
            ? [BrunoFileType.AppFile, BrunoFileType.RequestFile]
            : [BrunoFileType.AppFile],
    )
        .filter(({ sequence: otherSequence }) => otherSequence == sequence)
        .map(({ file }) => ({
            path: file,
            message: "File with same sequence",
        }));

    if (filesWithSameSequence.length == 0) {
        return undefined;
    }

    return {
        message:
            fileType == BrunoFileType.AppFile
                ? "Other app files or requests with the same sequence already exist within this folder."
                : "App files with the same sequence already exist within this folder.",
        range: sequenceRange,
        severity: DiagnosticSeverity.Warning,
        relatedInformation: getRelatedInformationForSequences(
            filesWithSameSequence,
        ),
    };
}
