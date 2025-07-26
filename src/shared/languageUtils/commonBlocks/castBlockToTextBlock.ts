import { Block, TextBlock } from "../../fileParsing/external/interfaces";

export function castBlockToTextBlock(block: Block) {
    return !Array.isArray(block.content) ? (block as TextBlock) : undefined;
}
