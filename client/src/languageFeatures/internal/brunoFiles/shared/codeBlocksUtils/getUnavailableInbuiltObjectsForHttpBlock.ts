import { BlockRuntimeExecutionGroup, JsCodeBlock } from "@global_shared";

/**
 * `res` is only available after the response was received.
 * `req` is only available before the request is sent, but additionally in `tests` blocks.
 */
export function getUnavailableInbuiltObjectsForHttpBlock({
    executionGroup,
    isTestsBlock,
}: Pick<JsCodeBlock, "executionGroup" | "isTestsBlock">): ("req" | "res")[] {
    return executionGroup == BlockRuntimeExecutionGroup.PreRequest
        ? ["res"]
        : executionGroup == BlockRuntimeExecutionGroup.PostResponse &&
            !isTestsBlock
          ? ["req"]
          : [];
}
