import { wrapInCodeSpan } from "../../markdown/wrapInCodeSpan";
import { DynamicBrunoVariable } from "./dynamicBrunoVariables";

/** The description of the variable, followed by its example values (e.g. `Examples: `a`, `b``). */
export function getMarkdownForDynamicBrunoVariable({
    description,
    examples,
}: DynamicBrunoVariable) {
    return `${description}. ${examples.length == 1 ? "Example" : "Examples"}: ${examples.map(wrapInCodeSpan).join(", ")}`;
}
