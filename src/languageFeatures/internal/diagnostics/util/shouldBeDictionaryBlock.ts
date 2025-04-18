import { RequestFileBlockName } from "../../../../shared";
import { getPossibleMethodBlocks } from "../../../../shared/fileSystem/testFileParsing/internal/getAllMethodBlocks";
import { isAuthBlock } from "../../../../shared/fileSystem/testFileParsing/internal/isAuthBlock";
import { isParamsBlock } from "../../../../shared/fileSystem/testFileParsing/internal/isParamsBlock";
import { isVarsBlock } from "../../../../shared/fileSystem/testFileParsing/internal/isVarsBlock";

export function shouldBeDictionaryBlock(blockName: string) {
    const allBlockNames = Object.values(RequestFileBlockName);

    if (!allBlockNames.some((validName) => blockName == validName)) {
        return undefined;
    }
    return (
        blockName == RequestFileBlockName.Meta ||
        blockName == RequestFileBlockName.Headers ||
        blockName == RequestFileBlockName.Assertions ||
        (getPossibleMethodBlocks() as string[]).includes(blockName) ||
        isAuthBlock(blockName) ||
        isParamsBlock(blockName) ||
        isVarsBlock(blockName)
    );
}
