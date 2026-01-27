import { LineBreakType, MethodBlockKey } from "..";
import { MethodBlockContent } from "./interfaces";
import { getContentForDictionaryBlock } from "./internal/getContentForDictionaryBlock";

export function getContentForDefaultMethodBlock(
    filePath: string,
    blockName: string,
    { url, body, auth }: MethodBlockContent,
    lineBreak?: LineBreakType,
) {
    return getContentForDictionaryBlock(
        filePath,
        blockName,
        [
            { key: MethodBlockKey.Url, value: url },
            { key: MethodBlockKey.Body, value: body },
            { key: MethodBlockKey.Auth, value: auth },
        ],
        lineBreak,
    );
}
