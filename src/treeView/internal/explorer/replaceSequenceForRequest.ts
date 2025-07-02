import { writeFileSync, readFileSync } from "fs";
import { getSequenceFromMetaBlock } from "../../../shared";

export function replaceSequenceForRequest(
    filePath: string,
    newSequence: number
) {
    const originalSequence = getSequenceFromMetaBlock(filePath);

    if (originalSequence != undefined) {
        writeFileSync(
            filePath,
            readFileSync(filePath)
                .toString()
                .replace(
                    new RegExp(`seq:\\s*${originalSequence}`),
                    `seq: ${newSequence}`
                )
        );
    }
}
