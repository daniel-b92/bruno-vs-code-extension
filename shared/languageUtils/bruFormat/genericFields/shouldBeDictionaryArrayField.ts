import { MetaBlockKey } from "../commonBlocks/metaBlock/metaBlockKeyEnum";
import { RequestFileBlockName } from "../../..";

export function shouldBeDictionaryArrayField(blockName: string, key: string) {
    return blockName == RequestFileBlockName.Meta && key == MetaBlockKey.Tags;
}
