import { writeFile, readFile } from "fs";
import {
    getSequenceValueRangeFromFileContent,
    TextDocumentHelper,
} from "@global_shared";
import { promisify } from "util";
import { window } from "vscode";

export async function replaceSequenceForFile(
    filePath: string,
    newSequence: number,
) {
    if (Number.isNaN(newSequence)) {
        throw new Error(`New sequence to set for file '${filePath}' is 'NaN'.`);
    }

    const originalFileContent = await promisify(readFile)(
        filePath,
        "utf-8",
    ).catch(() => undefined);

    if (originalFileContent === undefined) {
        window.showErrorMessage(
            `An unexpected error occured while trying to read the file content.`,
        );
        return;
    }

    const sequenceRange = getSequenceValueRangeFromFileContent(
        filePath,
        originalFileContent,
    );

    if (!sequenceRange) {
        return;
    }

    await promisify(writeFile)(
        filePath,
        new TextDocumentHelper(originalFileContent).getFullTextWithReplacement(
            {
                lineIndex: sequenceRange.start.line,
                startCharIndex: sequenceRange.start.character,
                endCharIndex: sequenceRange.end.character,
            },
            `${newSequence}`,
        ),
    ).catch(() => {
        window.showErrorMessage(
            `An unexpected error occured while trying to replace the sequence.`,
        );
    });
}
