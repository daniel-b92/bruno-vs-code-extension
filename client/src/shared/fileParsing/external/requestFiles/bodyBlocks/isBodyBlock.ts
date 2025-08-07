import { RequestFileBlockName } from "../../../../languageUtils/requestFiles/requestFileBlockNameEnum";

export function isBodyBlock(blockName: string) {
    return (
        Object.values(RequestFileBlockName).filter(
            (name) =>
                name.startsWith("body:") &&
                name != RequestFileBlockName.GraphQlBodyVars
        ) as string[]
    ).includes(blockName);
}
