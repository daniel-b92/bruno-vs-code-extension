import { Block, RequestFileBlockName } from "../../../../shared";
import { getCodeBlocks } from "./getCodeBlocks";
import { getTempJsFileBlockContent } from "./getTempJsFileBlockContent";

export function isTempJsFileInSync(
    tempJsFileFullContent: string,
    relevantBlocksFromBruFile: Block[]
) {
    const blocksFromBruFile = getCodeBlocks(relevantBlocksFromBruFile);

    return blocksFromBruFile.every(({ name, content: bruFileBlockContent }) => {
        const jsFileBlock = getTempJsFileBlockContent(
            tempJsFileFullContent,
            name as RequestFileBlockName
        );

        if (!jsFileBlock) {
            return false;
        }

        return jsFileBlock.content == bruFileBlockContent;
    });
}
