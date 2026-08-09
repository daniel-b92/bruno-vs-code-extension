import { Range } from "../../../..";
import { WithKeyAndValueRange } from "../../../external/yamlFormat/interfaces";

export function isWithKeyAndValueRange<T>(
    value: unknown,
): value is WithKeyAndValueRange<T> {
    return (
        typeof value == "object" &&
        value != null &&
        "keyRange" in value &&
        "value" in value &&
        "valueRange" in value &&
        value.keyRange instanceof Range &&
        value.valueRange instanceof Range
    );
}
