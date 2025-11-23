import { writeFile, readFile } from "fs";
import { MetaBlockKey, parseSequenceFromMetaBlock } from "../../../../shared";
import { promisify } from "util";

export async function replaceSequenceForFile(
    filePath: string,
    newSequence: number,
) {
    if (Number.isNaN(newSequence)) {
        throw new Error(`New sequence to set for file '${filePath}' is 'NaN'.`);
    }

    const originalSequence = await parseSequenceFromMetaBlock(filePath);

    if (originalSequence != undefined) {
        await promisify(writeFile)(
            filePath,
            (await promisify(readFile)(filePath, "utf-8")).replace(
                new RegExp(
                    `${MetaBlockKey.Sequence}:\\s*${originalSequence}\\s*$`,
                    "m",
                ),
                `${MetaBlockKey.Sequence}: ${newSequence}`,
            ),
        );
    }
}
