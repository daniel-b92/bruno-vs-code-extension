import { Scalar } from "yaml";
import { YamlParsingError, YamlParsingErrorCode } from "../../../..";
import {
    CommonParsingArgs,
    WithKeyAndKeyRange,
    WithKeyAndValueRange,
} from "../interfaces";
import { getRangeForItem } from "../util/getRangeForItem";
import { mapFromYamlScalar } from "./mapFromYamlScalar";

type Args<T> = {
    commonParsingArgs: CommonParsingArgs;
    allStringScalars: WithKeyAndKeyRange<Scalar<string>>[];
    keyName: string;
    allowedValues: T[];
};

export function getTypedScalarFromList<T extends string>(
    args: Args<T>,
    errorsCollection: YamlParsingError[],
): { value: WithKeyAndValueRange<T> } | undefined {
    const { allStringScalars, keyName, commonParsingArgs } = args;
    const maybeUntypedField = allStringScalars.find(
        ({ key }) => key == keyName,
    );

    if (!maybeUntypedField) {
        return undefined;
    }

    const maybeTypedField = toTypedField<T>(maybeUntypedField.value, args);

    if ("error" in maybeTypedField) {
        errorsCollection.push(maybeTypedField.error);
        return undefined;
    }
    return {
        value: mapFromYamlScalar({
            ...commonParsingArgs,
            value: maybeTypedField.item,
            keyRange: maybeUntypedField.keyRange,
        }),
    };
}

function toTypedField<T extends string>(
    unTyped: Scalar<string>,
    { allowedValues, commonParsingArgs }: Args<T>,
): { item: Scalar<T> } | { error: YamlParsingError } {
    if (!(allowedValues as string[]).includes(unTyped.value)) {
        return {
            error: {
                message: `Invalid value '${unTyped}'. Allowed values are ${JSON.stringify(allowedValues, null, 2)}`,
                range: getRangeForItem(unTyped, commonParsingArgs),
                code: YamlParsingErrorCode.Other,
            },
        };
    }

    return { item: unTyped as Scalar<T> };
}
