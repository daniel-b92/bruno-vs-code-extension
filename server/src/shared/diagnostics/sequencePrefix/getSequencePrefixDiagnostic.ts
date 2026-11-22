import { basename, dirname, extname, resolve } from "path";
import {
    addSequencePrefix,
    BrunoFileType,
    doesNameHaveSequencePrefixMatching,
    getSequenceValueRangeFromFileContent,
    Range,
    TextDocumentHelper,
} from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { DiagnosticWithCode } from "../../../bruFiles/diagnostics/interfaces";
import { RelevantWithinMetaBlockDiagnosticCode } from "../../../bruFiles/diagnostics/shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";

/** Data of the diagnostic that is needed for the quick fix, which renames the item on the client side. */
export interface SequencePrefixDiagnosticData {
    kind: "renameToMatchSequence";
    sourcePath: string;
    targetPath: string;
    isFile: boolean;
}

export function isSequencePrefixDiagnosticData(
    data: unknown,
): data is SequencePrefixDiagnosticData {
    return (
        typeof data == "object" &&
        data !== null &&
        (data as SequencePrefixDiagnosticData).kind == "renameToMatchSequence"
    );
}

/**
 * Checks whether the name of a request file, app file or folder starts with the sequence of the item, e.g. `010_` for sequence 10.
 * Works for both collection formats. The sequence is read from the given file content.
 * For folders, the given path and content are the ones of the folder settings file.
 */
export function getSequencePrefixDiagnostic(data: {
    filePath: string;
    content: string;
    fileType: BrunoFileType;
    sequenceStep: number;
}): DiagnosticWithCode | undefined {
    const { filePath, content, fileType, sequenceStep } = data;
    const isFolder = fileType == BrunoFileType.FolderSettingsFile;

    if (
        !isFolder &&
        fileType != BrunoFileType.RequestFile &&
        fileType != BrunoFileType.AppFile
    ) {
        return undefined;
    }

    const sequenceRange = getSequenceValueRangeFromFileContent(
        filePath,
        content,
    );
    const sequence = sequenceRange
        ? readSequence(content, sequenceRange)
        : undefined;

    if (!sequenceRange || sequence === undefined) {
        // Invalid sequences are reported by other checks.
        return undefined;
    }

    const itemPath = isFolder ? dirname(filePath) : filePath;
    const itemName = isFolder
        ? basename(itemPath)
        : basename(itemPath, extname(itemPath));

    if (doesNameHaveSequencePrefixMatching(itemName, sequence)) {
        return undefined;
    }

    const newName = isFolder
        ? addSequencePrefix(itemName, sequence, sequenceStep)
        : `${addSequencePrefix(itemName, sequence, sequenceStep)}${extname(itemPath)}`;
    const diagnosticData: SequencePrefixDiagnosticData = {
        kind: "renameToMatchSequence",
        sourcePath: itemPath,
        targetPath: resolve(dirname(itemPath), newName),
        isFile: !isFolder,
    };

    return {
        message: `The ${isFolder ? "folder" : "file"} name does not start with the sequence '${sequence}'. Expected the name '${newName}'.`,
        range: sequenceRange,
        severity: DiagnosticSeverity.Warning,
        code: RelevantWithinMetaBlockDiagnosticCode.SequenceNotMatchingItemName,
        data: diagnosticData,
    } satisfies Diagnostic as DiagnosticWithCode;
}

function readSequence(content: string, range: Range) {
    if (range.start.line != range.end.line) {
        return undefined;
    }

    const text = new TextDocumentHelper(content)
        .getLineByIndex(range.start.line)
        .slice(range.start.character, range.end.character)
        .trim();

    return /^\d+$/.test(text) ? Number.parseInt(text, 10) : undefined;
}
