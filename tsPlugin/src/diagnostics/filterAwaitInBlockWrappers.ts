import * as ts from "typescript/lib/tsserverlibrary";
import { findDeepestNodeContainingPosition } from "../codeBlocks/findDeepestNodeContainingPosition";
import { getCodeRangesGetter } from "../codeBlocks/getCodeRanges";
import { getOriginalFileContent } from "../fileContent";

// 1308: 'await' expressions are only allowed within async functions and at the top levels of modules.
// 1103: 'for await' loops are only allowed within async functions and at the top levels of modules.
const awaitInNonAsyncFunctionCodes = [1_308, 1_103];

/**
 * Code blocks that only have little space in front of them are wrapped in an arrow function without the `async` keyword (see `getBlockWrapperCandidates`).
 * Bruno runs every code block in an `async` function, so `await` is valid at the top level of such a block.
 *
 * `await` within functions and initializers of class fields that are declared in the code block is still reported,
 * since these are not async by default (see `findAwaitContext`). The wrapper is the only function that starts outside of the code ranges.
 */
export function filterAwaitInBlockWrappers(
    info: ts.server.PluginCreateInfo,
    fileName: string,
    diagnostics: ts.Diagnostic[],
) {
    if (
        !diagnostics.some(({ code }) =>
            awaitInNonAsyncFunctionCodes.includes(code),
        )
    ) {
        return diagnostics;
    }

    const sourceFile = info.languageService
        .getProgram()
        ?.getSourceFile(fileName);
    const originalContent = getOriginalFileContent(info, fileName);

    if (!sourceFile || originalContent == undefined) {
        return diagnostics;
    }

    const codeRanges = getCodeRangesGetter(info, fileName)(originalContent);

    return diagnostics.filter(({ code, start }) => {
        if (
            !awaitInNonAsyncFunctionCodes.includes(code) ||
            start == undefined
        ) {
            return true;
        }

        const awaitContext = findAwaitContext(
            findDeepestNodeContainingPosition(sourceFile, start),
        );

        return (
            awaitContext == undefined ||
            codeRanges.some(
                ({ start: rangeStart, end }) =>
                    rangeStart <= awaitContext.getStart(sourceFile) &&
                    awaitContext.getStart(sourceFile) <= end,
            )
        );
    });
}

/**
 * Like functions, initializers of class fields are not async, even if the class is declared within an async function.
 * Computed property names are evaluated in the scope around the class member, so the member is skipped for them.
 */
function findAwaitContext(node: ts.Node | undefined) {
    for (
        let current: ts.Node | undefined = node;
        current != undefined;
        current = current.parent
    ) {
        if (ts.isComputedPropertyName(current)) {
            current = current.parent;
        } else if (
            ts.isFunctionLike(current) ||
            (current.parent != undefined &&
                ts.isPropertyDeclaration(current.parent) &&
                current.parent.initializer == current)
        ) {
            return current;
        }
    }

    return undefined;
}
