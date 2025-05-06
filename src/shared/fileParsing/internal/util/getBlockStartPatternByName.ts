import { BlockBracket } from "./blockBracketEnum";

export function getBlockStartPatternByName(blockName: string) {
    return new RegExp(
        `^\\s*${blockName}\\s*(\\${BlockBracket.OpeningBracketForArrayBlock}|\\${BlockBracket.OpeningBracketForDictionaryOrTextBlock})\\s*$`,
        "m"
    );
}
