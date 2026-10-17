import { readFileSync } from "fs";
import { getSequenceValueRangeFromFileContent } from "@global_shared";
import { DiagnosticRelatedInformation } from "vscode-languageserver";
import { URI } from "vscode-uri";

/** Points to the sequence values of the given files. Files whose sequence cannot be determined are left out. */
export function getRelatedInformationForSequences(
    files: { path: string; message: string }[],
): DiagnosticRelatedInformation[] {
    return files.flatMap(({ path, message }) => {
        const range = getSequenceRange(path);

        return range
            ? [{ message, location: { uri: URI.file(path).toString(), range } }]
            : [];
    });
}

function getSequenceRange(path: string) {
    try {
        return getSequenceValueRangeFromFileContent(
            path,
            readFileSync(path, "utf-8"),
        );
    } catch {
        return undefined;
    }
}
