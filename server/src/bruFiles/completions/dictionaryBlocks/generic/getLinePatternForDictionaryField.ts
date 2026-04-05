export function getLinePatternForDictionaryField(specificKey?: string) {
    return specificKey != undefined
        ? new RegExp(`^\\s*${specificKey}:.*$`, "m")
        : /^.*?:.*$/m;
}
