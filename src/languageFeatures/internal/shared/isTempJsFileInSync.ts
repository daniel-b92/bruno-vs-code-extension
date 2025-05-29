import { Block, RequestFileBlockName } from "../../../shared";
import { getBlocksWithJsCode } from "./getBlocksWithJsCode";
import { getTempJsFileBlockContent } from "./getTempJsFileBlockContent";

export function isTempJsFileInSync(
    tempJsFileFullContent: string,
    relevantBlocksFromBruFile: Block[]
) {
    const blocksFromBruFile = getBlocksWithJsCode(relevantBlocksFromBruFile);

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
