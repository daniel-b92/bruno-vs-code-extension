/** @param bruParameterType If provided, the function gets a parameter `bru` that shadows the global `bru` object with the given type. */
export function mapBlockNameToJsFileLine(
    name: string,
    bruParameterType?: string,
) {
    return `${getFunctionDeclarationStart(name)}${bruParameterType ? `/** @type {${bruParameterType}} */ bru` : ""}) {`;
}

export function isJsFileLineForBlock(line: string, name: string) {
    return line.startsWith(getFunctionDeclarationStart(name));
}

function getFunctionDeclarationStart(name: string) {
    return `function ${name.replace(/-/g, "_").replace(/:/g, "_")}(`;
}
