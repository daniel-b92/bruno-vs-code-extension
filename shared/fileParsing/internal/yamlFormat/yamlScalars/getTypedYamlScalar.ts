import { isScalar, Scalar } from "yaml";
import { CommonParsingArgs } from "../interfaces";
import { getRangeForItem } from "../util/getRangeForItem";
import {
    YamlParsingError,
    YamlParsingErrorCode,
} from "../../../external/yamlFormat/interfaces";

enum FieldValueType {
    String = "string",
    Boolean = "boolean",
}

export function getStringYamlScalar(
    source: Scalar<unknown>,
    fieldName: string,
    additionalArgs: CommonParsingArgs,
) {
    return isScalar<string>(source)
        ? { item: source }
        : getTypeMismatchErrorResult(
              source,
              FieldValueType.String,
              fieldName,
              additionalArgs,
          );
}

export function getBooleanYamlScalar(
    source: Scalar<unknown>,
    fieldName: string,
    additionalArgs: CommonParsingArgs,
) {
    return isScalar<boolean>(source)
        ? { item: source }
        : getTypeMismatchErrorResult(
              source,
              FieldValueType.Boolean,
              fieldName,
              additionalArgs,
          );
}

function getTypeMismatchErrorResult(
    field: Scalar<unknown>,
    expectedValueType: string,
    fieldDescription: string,
    args: CommonParsingArgs,
): { error: YamlParsingError } {
    return {
        error: {
            message: `Scalar field '${fieldDescription}' should be a ${expectedValueType}.`,
            range: getRangeForItem(field, args),
            code: YamlParsingErrorCode.Other,
        },
    };
}
