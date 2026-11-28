import { writeFile, readFile } from "fs";
import {
    getSequenceValueRangeFromFileContent,
    TextDocumentHelper,
} from "@global_shared";
import { promisify } from "util";
import { window } from "vscode";

/** @returns Whether the sequence was replaced. */
export async function replaceSequenceForFile(
    filePath: string,
    newSequence: number,
    /** Should be `false` if the caller shows its own error message for a failed replacement. */
    showErrorMessages = true,
) {
    if (Number.isNaN(newSequence)) {
        throw new Error(`New sequence to set for file '${filePath}' is 'NaN'.`);
    }

    const originalFileContent = await promisify(readFile)(
        filePath,
        "utf-8",
    ).catch(() => undefined);

    if (originalFileContent === undefined) {
        if (showErrorMessages) {
            window.showErrorMessage(
                `An unexpected error occured while trying to read the file content.`,
            );
        }
        return false;
    }

    const sequenceRange = getSequenceValueRangeFromFileContent(
        filePath,
        originalFileContent,
    );

    if (!sequenceRange) {
        return false;
    }

    return await promisify(writeFile)(
        filePath,
        new TextDocumentHelper(originalFileContent).getFullTextWithReplacement(
            {
                lineIndex: sequenceRange.start.line,
                startCharIndex: sequenceRange.start.character,
                endCharIndex: sequenceRange.end.character,
            },
            `${newSequence}`,
        ),
    )
        .then(() => true)
        .catch(() => {
            if (showErrorMessages) {
                window.showErrorMessage(
                    `An unexpected error occured while trying to replace the sequence.`,
                );
            }
            return false;
        });
}
