export interface TypedParameter {
    name: string;
    /** JSDoc type. */
    type: string;
}

/**
 * The code block is wrapped in an anonymous function expression instead of a function declaration.
 * Otherwise, the block names (e.g. `script_grpc_before_call_start`) would be bindings in the module scope and show up in completions.
 * The block name is only kept in a leading comment, so the line can be found again.
 * `async` matches the runtime behaviour of Bruno, where `await` can be used within script blocks.
 *
 * @param parameters Typed parameters that shadow the global objects of the same name inside the function.
 */
export function mapBlockNameToJsFileLine(
    name: string,
    parameters: TypedParameter[] = [],
) {
    const parameterList = parameters
        .map(({ name, type }) => `/** @type {${type}} */ ${name}`)
        .join(", ");

    return `${getFunctionStart(name)}${parameterList}) {`;
}

export function isJsFileLineForBlock(line: string, name: string) {
    return line.startsWith(getFunctionStart(name));
}

function getFunctionStart(name: string) {
    return `/* ${name} */ void async function (`;
}
