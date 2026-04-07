import { MethodBlockKey, RequestFileBlockName } from "../../..";

export function getMandatoryKeys(blockName: string) {
    const allKeys = Object.values(MethodBlockKey);

    return blockName == RequestFileBlockName.Http
        ? allKeys
        : allKeys.filter((key) => key != MethodBlockKey.Method);
}
