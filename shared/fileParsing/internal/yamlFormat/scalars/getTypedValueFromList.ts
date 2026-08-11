import { YamlParsingError, YamlParsingErrorCode } from "../../../..";
import {
    WithKeyAndValueRange,
    WithKeyKeyRangeAndValueRange,
} from "../interfaces";
import { stripKeyFromResult } from "../util/stripKeyFromResult";

type Args<T> = {
    allStringValues: WithKeyKeyRangeAndValueRange<string>[];
    keyName: string;
    allowedValues: T[];
};

export function getTypedValueFromList<T extends string>(
    args: Args<T>,
    errorsCollection: YamlParsingError[],
): { value: WithKeyAndValueRange<T> } | undefined {
    const { allStringValues, keyName } = args;
    const maybeUntypedValue = allStringValues.find(({ key }) => key == keyName);

    if (!maybeUntypedValue) {
        return undefined;
    }

    const maybeTypedField = toTypedValue<T>(maybeUntypedValue, args);

    if ("error" in maybeTypedField) {
        errorsCollection.push(maybeTypedField.error);
        return undefined;
    }
    return { value: stripKeyFromResult(maybeTypedField.value) };
}

function toTypedValue<T extends string>(
    unTyped: WithKeyKeyRangeAndValueRange<string>,
    { allowedValues }: Args<T>,
): { value: WithKeyKeyRangeAndValueRange<T> } | { error: YamlParsingError } {
    if (!(allowedValues as string[]).includes(unTyped.value)) {
        return {
            error: {
                message: `Invalid value '${unTyped}'. Allowed values are ${JSON.stringify(allowedValues, null, 2)}`,
                range: unTyped.valueRange,
                code: YamlParsingErrorCode.Other,
            },
        };
    }

    return { value: unTyped as WithKeyKeyRangeAndValueRange<T> };
}
