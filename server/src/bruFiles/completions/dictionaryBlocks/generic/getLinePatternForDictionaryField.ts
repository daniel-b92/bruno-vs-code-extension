export function getLinePatternForDictionaryField(key: string) {
    return new RegExp(`^\\s*${key}:.*$`, "m");
}
