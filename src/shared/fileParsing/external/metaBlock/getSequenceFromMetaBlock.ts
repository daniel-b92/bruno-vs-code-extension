import { TextDocumentHelper } from "../../../fileSystem/util/textDocumentHelper";
import { MetaBlockKey } from "../../../languageUtils/metaBlock/metaBlockKeyEnum";
import { RequestFileBlockName } from "../../../languageUtils/requestFileBlockNameEnum";
import { isDictionaryBlockField } from "../../internal/util/isDictionaryBlockField";
import { parseBlockFromFile } from "../parseBlockFromFile";

export function getSequenceFromMetaBlock(documentHelper: TextDocumentHelper) {
    const metaBlockContent = parseBlockFromFile(
        documentHelper,
        RequestFileBlockName.Meta
    );

    const sequence =
        metaBlockContent &&
        Array.isArray(metaBlockContent) &&
        metaBlockContent.length > 0 &&
        metaBlockContent.every((content) => isDictionaryBlockField(content))
            ? metaBlockContent.find(({ key }) => key == MetaBlockKey.Sequence)
            : undefined;

    return sequence;
}
