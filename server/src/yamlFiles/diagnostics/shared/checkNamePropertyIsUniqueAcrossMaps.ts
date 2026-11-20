import { WithKeyAndValueRange } from "@global_shared";
import { CommonDiagnosticParams } from "../../interfaces";
import { checkPropertiesAreUnique } from "./generic/checkPropertiesAreUnique";

export function checkNamePropertyIsUniqueAcrossMaps(
    maps: {
        properties: {
            name?: WithKeyAndValueRange<string>;
        };
    }[],
    { filePath }: CommonDiagnosticParams,
) {
    const nameFields = maps
        .map(({ properties: { name } }) => name)
        .filter((val) => val != undefined);

    return checkPropertiesAreUnique(filePath, nameFields, "name");
}
