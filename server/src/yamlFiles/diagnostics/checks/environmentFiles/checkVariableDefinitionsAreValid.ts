import {
    ParsedEnvironmentVariable,
    WithKeyAndValueRange,
} from "@global_shared";
import { Diagnostic } from "vscode-languageserver";

export function checkVariableDefinitionsAreValid(
    variables: ParsedEnvironmentVariable[],
): (Diagnostic | undefined)[] {
    return variables.map(({ name }) => checkNameIsValid(name));
}

function checkNameIsValid({
    value,
    valueRange,
}: WithKeyAndValueRange<string>): Diagnostic | undefined {
    return value
        ? undefined
        : {
              message: "Name may not be empty or NULL.",
              range: valueRange,
          };
}
