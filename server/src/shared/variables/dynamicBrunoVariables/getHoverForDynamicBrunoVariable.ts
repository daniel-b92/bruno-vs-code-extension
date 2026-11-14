import { Hover } from "vscode-languageserver";
import { wrapInCodeSpan } from "../../markdown/wrapInCodeSpan";
import { getDynamicBrunoVariableByName } from "./dynamicBrunoVariables";

/** Returns `undefined` if the name is not one of Bruno's built-in dynamic variables. */
export function getHoverForDynamicBrunoVariable(
    variableName: string,
): Hover | undefined {
    const variable = getDynamicBrunoVariableByName(variableName);

    return variable
        ? {
              contents: {
                  kind: "markdown",
                  value: `${variable.description}. Example: ${wrapInCodeSpan(variable.example)}`,
              },
          }
        : undefined;
}
