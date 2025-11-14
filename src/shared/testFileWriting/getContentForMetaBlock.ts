import { LineBreakType } from "../fileSystem/util/getLineBreak";
import { MetaBlockKey } from "../languageUtils/commonBlocks/metaBlock/metaBlockKeyEnum";
import { RequestFileBlockName } from "../languageUtils/requestFiles/requestFileBlockNameEnum";
import { MetaBlockContent } from "./interfaces";
import { getContentForDictionaryBlock } from "./internal/getContentForDictionaryBlock";

export function getContentForMetaBlock(
    filePath: string,
    { name, type, sequence }: MetaBlockContent,
    lineBreak?: LineBreakType,
) {
    return getContentForDictionaryBlock(filePath, RequestFileBlockName.Meta, [
        { key: MetaBlockKey.Name, value: name },
        { key: MetaBlockKey.Type, value: type },
        { key: MetaBlockKey.Sequence, value: sequence.toString() },
    ], lineBreak);
}
