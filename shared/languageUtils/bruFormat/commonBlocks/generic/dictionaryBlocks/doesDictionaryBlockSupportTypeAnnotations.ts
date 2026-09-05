import {
    isVarsBlockInEnvironmentFile,
    isVarsBlockInRequestFile,
} from "../../../../..";

export function doesDictionaryBlockSupportTypeAnnotations(
    dictionaryBlockName: string,
) {
    return (
        isVarsBlockInRequestFile(dictionaryBlockName) ||
        isVarsBlockInEnvironmentFile(dictionaryBlockName)
    );
}
