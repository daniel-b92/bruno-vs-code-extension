import { WithKeyAndValueRange } from "@global_shared";
import { Diagnostic } from "vscode-languageserver";
import { checkCombinationOfPropertiesIsUnique } from "./checkCombinationOfPropertiesIsUnique";

export function checkPropertiesAreUnique<T>(
    filePath: string,
    properties: WithKeyAndValueRange<T>[],
    propertyName: string,
): (Diagnostic | undefined)[] {
    return checkCombinationOfPropertiesIsUnique(
        filePath,
        properties.map(({ value, valueRange }) => ({
            values: [String(value)],
            range: valueRange,
        })),
        [propertyName],
    );
}
