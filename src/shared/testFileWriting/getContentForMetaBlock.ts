import { LineBreakType, MetaBlockKey, RequestFileBlockName } from "..";
import { MetaBlockContent } from "./interfaces";
import { getContentForDictionaryBlock } from "./internal/getContentForDictionaryBlock";

export function getContentForMetaBlock(
    filePath: string,
    { name, type, sequence }: MetaBlockContent,
    lineBreak?: LineBreakType,
) {
    return getContentForDictionaryBlock(
        filePath,
        RequestFileBlockName.Meta,
        [
            { key: MetaBlockKey.Name, value: name },
            { key: MetaBlockKey.Type, value: type },
            { key: MetaBlockKey.Sequence, value: sequence.toString() },
        ],
        lineBreak,
    );
}
