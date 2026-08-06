import { CommonParsingArgs } from "../interfaces";
import { YamlParsingError, YamlParsingSpecialErrorCode } from "../../../..";
import { YAMLMap } from "yaml";
import { getRangeForError } from "../util/getRangeForError";

export function getErrorForMissingKeyInMap(
    args: CommonParsingArgs & {
        missingKey: string;
        map: YAMLMap<unknown, unknown>;
    },
): YamlParsingError {
    const { missingKey, map } = args;
    return {
        message: `Mandatory key '${missingKey}' missing in Yaml map.`,
        range: getRangeForError(map, args),
        code: YamlParsingSpecialErrorCode.FieldDoesNotExist,
    };
}
