import { YAMLMap } from "yaml";
import { CommonParsingArgs } from "../interfaces";
import { validateKeyExistsInMap } from "./validateKeyExistsInMap";
import { getRangeForError } from "../util/getRangeForError";

enum FieldValueType {
    String = "string",
    Boolean = "boolean",
}

type AllArgs = CommonParsingArgs & {
    map: YAMLMap<unknown, unknown>;
    key: string;
    isTopLevelMap: boolean;
};

export function getStringValueByKeyFromMap(args: AllArgs) {
    const { map, key } = args;

    const existenceError = validateKeyExistsInMap(args);
    if (existenceError) {
        return { error: existenceError };
    }

    return getStringResultForExistingField(map.get(key), args);
}

export function getBooleanValueByKeyFromMap(args: AllArgs) {
    const { map, key } = args;

    const existenceError = validateKeyExistsInMap(args);
    if (existenceError) {
        return { error: existenceError };
    }

    return getBooleanResultForExistingField(map.get(key), args);
}

function getStringResultForExistingField(field: unknown, args: AllArgs) {
    return typeof field == "string"
        ? { value: field }
        : getTypeMismatchErrorResult(FieldValueType.String, args);
}

function getBooleanResultForExistingField(field: unknown, args: AllArgs) {
    return typeof field == "boolean"
        ? { value: field }
        : getTypeMismatchErrorResult(FieldValueType.Boolean, args);
}

function getTypeMismatchErrorResult(valueType: FieldValueType, args: AllArgs) {
    const { fullDocumentRange, isTopLevelMap, key, map } = args;
    return {
        error: {
            message: `Field '${key}' should be a ${valueType}.`,
            range: isTopLevelMap
                ? fullDocumentRange
                : getRangeForError(map, args),
        },
    };
}
