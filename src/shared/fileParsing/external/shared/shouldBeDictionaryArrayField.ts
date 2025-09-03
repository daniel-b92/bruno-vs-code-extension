import { MetaBlockKey } from "../../../languageUtils/commonBlocks/metaBlock/metaBlockKeyEnum";
import { RequestFileBlockName } from "../../../languageUtils/requestFiles/requestFileBlockNameEnum";

export function shouldBeDictionaryArrayField(blockName: string, key: string) {
    return blockName == RequestFileBlockName.Meta && key == MetaBlockKey.Tags;
}
