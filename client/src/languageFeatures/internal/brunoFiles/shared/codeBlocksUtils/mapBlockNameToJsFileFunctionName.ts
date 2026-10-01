export interface TypedParameter {
    name: string;
    /** JSDoc type. */
    type: string;
}

/** @param parameters Typed parameters that shadow the global objects of the same name inside the function. */
export function mapBlockNameToJsFileLine(
    name: string,
    parameters: TypedParameter[] = [],
) {
    const parameterList = parameters
        .map(({ name, type }) => `/** @type {${type}} */ ${name}`)
        .join(", ");

    return `${getFunctionDeclarationStart(name)}${parameterList}) {`;
}

export function isJsFileLineForBlock(line: string, name: string) {
    return line.startsWith(getFunctionDeclarationStart(name));
}

function getFunctionDeclarationStart(name: string) {
    return `function ${name.replace(/-/g, "_").replace(/:/g, "_")}(`;
}
