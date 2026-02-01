import { writeFile, readFile } from "fs";
import { MetaBlockKey, parseSequenceFromMetaBlock } from "@global_shared";
import { promisify } from "util";
import { window } from "vscode";

export async function replaceSequenceForFile(
    filePath: string,
    newSequence: number,
) {
    if (Number.isNaN(newSequence)) {
        throw new Error(`New sequence to set for file '${filePath}' is 'NaN'.`);
    }

    const originalSequence = await parseSequenceFromMetaBlock(filePath);
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

    if (originalSequence != undefined) {
        await promisify(writeFile)(
            filePath,
            originalFileContent.replace(
                new RegExp(
                    `${MetaBlockKey.Sequence}:\\s*${originalSequence}\\s*$`,
                    "m",
                ),
                `${MetaBlockKey.Sequence}: ${newSequence}`,
            ),
        ).catch(() => {
            window.showErrorMessage(
                `An unexpected error occured while trying to replace the sequence.`,
            );
        });
    }
}
