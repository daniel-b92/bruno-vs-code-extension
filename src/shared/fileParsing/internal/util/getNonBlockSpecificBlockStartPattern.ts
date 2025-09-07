import { BlockBracket } from "./blockBracketEnum";

export function getNonBlockSpecificBlockStartPattern() {
    return new RegExp(
        `^\\s*(\\w+(((:|-))\\w+)*)\\s*(\\${BlockBracket.OpeningBracketForArrayBlock}|\\${BlockBracket.OpeningBracketForDictionaryOrTextBlock})\\s*$`,
        "m",
    );
}
