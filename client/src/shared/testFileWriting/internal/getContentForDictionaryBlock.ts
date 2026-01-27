import { getLineBreak, LineBreakType } from "../..";
import { getNumberOfWhitespacesForIndentation } from "./writerUtils";

export function getContentForDictionaryBlock(
    filePath: string,
    blockName: string,
    data: { key: string; value: string }[],
    lineBreak?: LineBreakType,
) {
    const lineBreakToUse = lineBreak ?? getLineBreak(filePath);
    const whitespacesForIndentation = getNumberOfWhitespacesForIndentation();

    return `${blockName} {${lineBreakToUse}`.concat(
        data
            .map(
                ({ key, value }) =>
                    `${" ".repeat(whitespacesForIndentation)}${key}: ${value}`,
            )
            .join(lineBreakToUse),
        lineBreakToUse,
        "}",
        lineBreakToUse,
    );
}
