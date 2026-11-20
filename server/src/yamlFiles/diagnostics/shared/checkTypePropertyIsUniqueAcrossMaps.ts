import { WithKeyAndValueRange } from "@global_shared";
import { CommonDiagnosticParams } from "../../interfaces";
import { checkPropertiesAreUnique } from "./generic/checkPropertiesAreUnique";

export function checkTypePropertyIsUniqueAcrossMaps(
    maps: {
        properties: {
            type?: WithKeyAndValueRange<string>;
        };
    }[],
    { filePath }: CommonDiagnosticParams,
) {
    const typeFields = maps
        .map(({ properties: { type } }) => type)
        .filter((val) => val != undefined);

    return checkPropertiesAreUnique(filePath, typeFields, "type");
}
