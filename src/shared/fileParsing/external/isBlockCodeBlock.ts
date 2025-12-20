import { shouldBeCodeBlock } from "../../languageUtils/commonBlocks/shouldBeCodeBlock";
import { Block, CodeBlock } from "./interfaces";

export function isBlockCodeBlock(block: Block): block is CodeBlock {
    return (
        shouldBeCodeBlock(block.name) &&
        Object.keys(block).includes("contentAsTsNode")
    );
}
