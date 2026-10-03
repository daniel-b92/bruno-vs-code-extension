import { ParsedRequestHeader } from "@global_shared";
import { Diagnostic } from "vscode-languageserver";
import { checkCombinationOfPropertiesIsUnique } from "./generic/checkCombinationOfPropertiesIsUnique";

export function checkHeaderNamesAreUnique(
    enabledHeaders: ParsedRequestHeader[],
    filePath: string,
): (Diagnostic | undefined)[] {
    return checkCombinationOfPropertiesIsUnique(
        filePath,
        enabledHeaders.flatMap(({ valueRange, properties: { name } }) =>
            // Header names are case-insensitive.
            name
                ? { values: [name.value.toLowerCase()], range: valueRange }
                : [],
        ),
        ["name"],
    );
}
