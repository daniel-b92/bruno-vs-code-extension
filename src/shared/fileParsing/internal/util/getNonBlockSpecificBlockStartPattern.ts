import { BlockBracket } from "../../..";

export function getNonBlockSpecificBlockStartPattern() {
    return new RegExp(
        `^\\s*(\\w+(((:|-))\\w+)*)\\s*(\\${BlockBracket.OpeningBracketForArrayBlock}|\\${BlockBracket.OpeningBracketForDictionaryOrTextBlock})\\s*$`,
        "m",
    );
}
