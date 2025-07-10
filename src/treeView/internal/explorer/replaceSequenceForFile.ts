import { writeFileSync, readFileSync } from "fs";
import { MetaBlockKey, parseSequenceFromMetaBlock } from "../../../shared";

export function replaceSequenceForFile(filePath: string, newSequence: number) {
    const originalSequence = parseSequenceFromMetaBlock(filePath);

    if (originalSequence != undefined) {
        writeFileSync(
            filePath,
            readFileSync(filePath)
                .toString()
                .replace(
                    new RegExp(
                        `${MetaBlockKey.Sequence}:\\s*${originalSequence}\\s*$`,
                        "m"
                    ),
                    `${MetaBlockKey.Sequence}: ${newSequence}`
                )
        );
    }
}
