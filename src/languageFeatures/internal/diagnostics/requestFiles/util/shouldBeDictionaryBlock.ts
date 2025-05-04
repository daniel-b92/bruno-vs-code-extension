import {
    getPossibleMethodBlocks,
    RequestFileBlockName,
    isAuthBlock,
    isParamsBlock,
    isVarsBlock,
} from "../../../../../shared";

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
        isVarsBlock(blockName) ||
        (
            [
                RequestFileBlockName.MultipartFormBody,
                RequestFileBlockName.FormUrlEncodedBody,
                RequestFileBlockName.FileOrBinaryBody,
            ] as string[]
        ).includes(blockName)
    );
}
