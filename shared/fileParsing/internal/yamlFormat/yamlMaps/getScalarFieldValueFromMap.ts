import { YAMLMap } from "yaml";
import { CommonParsingArgs } from "../interfaces";
import { YamlParsingError } from "../../../..";
import { validateKeyExistsInMap } from "./validateKeyExistsInMap";
import { fromYamlRange } from "../util/fromYamlRange";

enum ScalarFieldValueType {
    String = "string",
    Boolean = "boolean",
}

type AllArgs = CommonParsingArgs & {
    map: YAMLMap<unknown, unknown>;
    key: string;
    isTopLevelMap: boolean;
};

export function getScalarFieldStringValueFromMap(
    args: AllArgs,
): { value: string } | { fieldExists: boolean; error: YamlParsingError } {
    const { map, key } = args;

    const existenceError = validateKeyExistsInMap(args);
    if (existenceError) {
        return { fieldExists: false, error: existenceError };
    }

    return getResultForExistingField(
        map.get(key),
        ScalarFieldValueType.String,
        args,
    ) as { value: string } | { fieldExists: boolean; error: YamlParsingError };
}

export function getScalarFieldBooleanValueFromMap(
    args: AllArgs,
): { value: boolean } | { fieldExists: boolean; error: YamlParsingError } {
    const { map, key } = args;

    const existenceError = validateKeyExistsInMap(args);
    if (existenceError) {
        return { fieldExists: false, error: existenceError };
    }

    return getResultForExistingField(
        map.get(key),
        ScalarFieldValueType.Boolean,
        args,
    ) as { value: boolean } | { fieldExists: boolean; error: YamlParsingError };
}

function getResultForExistingField(
    field: unknown,
    valueType: ScalarFieldValueType,
    args: AllArgs,
) {
    switch (valueType) {
        case ScalarFieldValueType.String:
            return typeof field == "string"
                ? { value: field }
                : getTypeMismatchErrorResult(valueType, args);
        case ScalarFieldValueType.Boolean:
            return typeof field == "boolean"
                ? ({ value: field } as { value: boolean })
                : getTypeMismatchErrorResult(valueType, args);
    }
}

function getTypeMismatchErrorResult(
    valueType: ScalarFieldValueType,
    args: AllArgs,
) {
    const { docHelper, fullDocumentRange, isTopLevelMap, key, map } = args;
    return {
        fieldExists: true,
        error: {
            message: `Field '${key}' should be a ${valueType}.`,
            range: isTopLevelMap
                ? fullDocumentRange
                : ((map.range
                      ? fromYamlRange(map.range, docHelper)
                      : fullDocumentRange) ?? fullDocumentRange),
        },
    };
}
