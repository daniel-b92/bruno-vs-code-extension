import { CodeBlockName } from "../constants";
import { grpcBruTypeNames } from "../runtimeDefinitions/getRuntimeDefinitionsFileContent";

/**
 * Returns the possible wrappers for a code block, ordered by preference. Each wrapper is a list of tokens,
 * that need to be placed before the opening bracket of the code block in the given order (the last token ends with the opening bracket).
 * There must be at least one whitespace (e.g. a line break) between the tokens, so each token has to be valid on its own line.
 *
 * Bruno executes each code block in its own `async` function. Therefore, the code block is wrapped in an anonymous arrow function,
 * that is used as an expression statement (so that no closing bracket is needed, which could not be inserted after the code block):
 * - Declarations are scoped like at runtime.
 * - `await` and `return` can be used at the top level of the block.
 * - Parameters (with types in JSDoc) shadow the global objects that are not available for the block.
 *
 * Wrappers with less information are used as a fallback, if there is not enough space in front of the code block (because the code block
 * is already preceded by e.g. only a few characters). Content cannot be inserted, since that would shift the positions of the following code.
 * In the worst case, the code block is just treated as a normal block, so top-level `await` and `return` are reported as errors by the Typescript server.
 *
 * A leading semicolon avoids that the wrapper is handled as a continuation of the previous statement.
 */
export function getBlockWrapperCandidates(
    blockName: CodeBlockName,
    isGrpcRequest: boolean,
) {
    const parameters = getShadowingParameters(blockName, isGrpcRequest);

    return [
        ...(parameters.length > 0
            ? [
                  [
                      // There must not be a line break between `async` and the parameters.
                      ";async(",
                      ...parameters.flatMap(({ name, type }, index) => [
                          // A JSDoc comment can be spread across multiple lines.
                          `${index > 0 ? "," : ""}/**`,
                          `@type{${type}}`,
                          "*/",
                          name,
                      ]),
                      // There must not be a line break between the parameters and the arrow.
                      ")=>{",
                  ],
              ]
            : []),
        [";async(", ")=>{"],
        [";{"],
        ["{"],
    ];
}

/**
 * `req` is only available before the request is sent, but additionally in `tests` blocks.
 * `res` is only available after the response was received.
 * For gRPC requests, `req` and `res` are not available at all. Only the parts of `bru.grpc` that are available at the time are typed.
 */
function getShadowingParameters(
    blockName: CodeBlockName,
    isGrpcRequest: boolean,
): { name: string; type: string }[] {
    const isPreRequest = [
        CodeBlockName.PreRequestScript,
        CodeBlockName.GrpcBeforeCallStartScript,
        CodeBlockName.GrpcBeforeMessageSendScript,
    ].includes(blockName);

    if (isGrpcRequest) {
        return [
            {
                name: "bru",
                type: isPreRequest
                    ? grpcBruTypeNames.preRequest
                    : grpcBruTypeNames.postResponse,
            },
        ];
    }

    return isPreRequest
        ? [{ name: "res", type: "undefined" }]
        : blockName == CodeBlockName.Tests
          ? []
          : [{ name: "req", type: "undefined" }];
}
