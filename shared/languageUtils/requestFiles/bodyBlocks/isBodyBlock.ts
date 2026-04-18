import { getAllValidBodyBlocks } from "../../..";

export function isBodyBlock(blockName: string) {
    return getAllValidBodyBlocks().includes(blockName);
}
