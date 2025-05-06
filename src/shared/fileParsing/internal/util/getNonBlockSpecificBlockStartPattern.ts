import { BlockBracket } from "./blockBracketEnum";

export function getNonBlockSpecificBlockStartPattern() {
    return new RegExp(
        `^\\s*(\\S+)\\s*(\\${BlockBracket.OpeningBracketForArrayBlock}|\\${BlockBracket.OpeningBracketForDictionaryOrTextBlock})\\s*$`,
        "m"
    );
}
