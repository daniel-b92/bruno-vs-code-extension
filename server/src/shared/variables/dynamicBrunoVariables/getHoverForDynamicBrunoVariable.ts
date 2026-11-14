import { Hover } from "vscode-languageserver";
import { getDynamicBrunoVariableByName } from "./dynamicBrunoVariables";
import { getMarkdownForDynamicBrunoVariable } from "./getMarkdownForDynamicBrunoVariable";

/** Returns `undefined` if the name is not one of Bruno's built-in dynamic variables. */
export function getHoverForDynamicBrunoVariable(
    variableName: string,
): Hover | undefined {
    const variable = getDynamicBrunoVariableByName(variableName);

    return variable
        ? {
              contents: {
                  kind: "markdown",
                  value: getMarkdownForDynamicBrunoVariable(variable),
              },
          }
        : undefined;
}
