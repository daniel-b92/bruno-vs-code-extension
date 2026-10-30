import { CodeBlockName } from "../constants";
import { wrapperVariableNames } from "../runtimeDefinitions/getRuntimeDefinitionsFileContent";
import { getTopLevelDeclarations } from "./getTopLevelDeclarations";

/**
 * Returns the possible wrappers for a code block, ordered by preference. Each wrapper is a list of tokens,
 * that need to be placed before the opening bracket of the code block in the given order (the last token ends with the opening bracket).
 * There must be at least one whitespace (e.g. a line break) between the tokens, so each token has to be valid on its own line.
 *
 * Bruno executes each code block in its own `async` function. Therefore, the code block is wrapped in an anonymous arrow function,
 * that is used as an expression statement (so that no closing bracket is needed, which could not be inserted after the code block):
 * - Declarations are scoped like at runtime.
 * - `await` and `return` can be used at the top level of the block.
 * - Parameters shadow the global objects that are not available for the block (`res` in pre-request blocks, `bru` in gRPC blocks).
 *   If the block declares a variable with the name of the parameter itself, the typed wrapper is not used, since a parameter cannot be redeclared.
 *   Otherwise, the variable would have the type of the parameter and its declaration would be reported as a duplicate.
 *
 * The types of the parameters are inferred from the variable that the function is assigned to (see `wrapperVariableNames`),
 * since the types could not be written down in the limited space in front of the code block.
 *
 * Wrappers with less information are used as a fallback, if there is not enough space in front of the code block (because the code block
 * is already preceded by e.g. only a few characters). Content cannot be inserted, since that would shift the positions of the following code.
 * The wrapper without the `async` keyword is the shortest one that still scopes the declarations of the block, but `await` is reported as an error for it.
 * In the worst case, the code block is just treated as a normal block, so top-level `await` and `return` are reported as errors by the Typescript server.
 *
 * A leading semicolon avoids that the wrapper is handled as a continuation of the previous statement.
 */
export function getBlockWrapperCandidates(
    blockName: CodeBlockName,
    isGrpcRequest: boolean,
    code: string,
) {
    const typedWrapper = getTypedWrapper(blockName, isGrpcRequest, code);

    return [
        ...(typedWrapper ? [typedWrapper] : []),
        [";async(", ")=>{"],
        [";()=>{"],
        [";{"],
        ["{"],
    ];
}

/**
 * `res` is only available after the response was received. `req` is available in all blocks of HTTP requests.
 * For gRPC requests, `req` and `res` are not available at all. Only the parts of `bru.grpc` that are available at the time are typed.
 * Blocks without objects to shadow (e.g. `tests`) have no typed wrapper.
 */
function getTypedWrapper(
    blockName: CodeBlockName,
    isGrpcRequest: boolean,
    code: string,
) {
    const isPreRequest = [
        CodeBlockName.PreRequestScript,
        CodeBlockName.GrpcBeforeCallStartScript,
        CodeBlockName.GrpcBeforeMessageSendScript,
    ].includes(blockName);

    const wrapper = isGrpcRequest
        ? {
              variableName: isPreRequest
                  ? wrapperVariableNames.grpcPreRequest
                  : wrapperVariableNames.grpcPostResponse,
              parameterName: "bru",
          }
        : isPreRequest
          ? {
                variableName: wrapperVariableNames.preRequest,
                parameterName: "res",
            }
          : undefined;

    return wrapper &&
        !getTopLevelDeclarations(code).some(
            ({ name }) => name == wrapper.parameterName,
        )
        ? createTypedWrapper(wrapper.variableName, wrapper.parameterName)
        : undefined;
}

function createTypedWrapper(variableName: string, parameterName: string) {
    // There must not be a line break between `async` and the opening parenthesis or between the closing parenthesis and the arrow.
    // The function starts within the first token, which is always placed at the start of a line (see `placeTokens`).
    return [`;${variableName}=async(`, `${parameterName})=>{`];
}
