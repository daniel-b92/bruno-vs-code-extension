import { YAMLSeq } from "yaml";
import {
    CommonParsingArgs,
    ParsedScript,
    ParsingResult,
    WithKeyKeyRangeAndValueRange,
} from "../interfaces";
import { YamlParsingError } from "../../../..";
import { getYamlMapsFromSequence } from "../yamlSequences/getYamlMapsFromSequence";
import { getMapItems } from "../yamlMaps/getMapItems";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { getErrorForMissingKeyInMap } from "../parsingErrors/getErrorForMissingKeyInMap";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";
import { isParsingResultOnlyErrors } from "../util/isParsingResultOnlyErrors";
import { ScriptType } from "./constants/sharedConstants";

enum ScriptMapProperty {
    Type = "type",
    Code = "code",
}

export function parseScriptsFromYamlSequence(
    scriptsSequence: YAMLSeq,
    commonArgs: CommonParsingArgs,
): ParsingResult<ParsedScript[]> {
    const scripts: ParsedScript[] = [];
    const errors: YamlParsingError[] = [];

    const { items: scriptMaps, errors: sequenceParsingErrors } =
        getYamlMapsFromSequence({
            ...commonArgs,
            sequence: scriptsSequence,
        });
    errors.push(...sequenceParsingErrors);

    const keysForStringScalars = [
        ScriptMapProperty.Code,
        ScriptMapProperty.Type,
    ];

    for (const currentMap of scriptMaps) {
        const {
            items: {
                unknownKeys,
                missingKeys,
                validScalars: { withStringValue: validStringScalars },
            },
            errors: mapItemErrors,
        } = getMapItems(
            currentMap,
            {
                scalars: {
                    stringValues: keysForStringScalars,
                },
            },
            commonArgs,
        );

        errors.push(
            ...mapItemErrors.concat(
                unknownKeys.map(({ key, keyRange }) =>
                    getErrorForUnknownKeyInMap({
                        ...commonArgs,
                        unknownKey: key,
                        keyRange,
                        allowedKeys: keysForStringScalars,
                    }),
                ),
                // All properties are mandatory for scripts.
                missingKeys.map((key) =>
                    getErrorForMissingKeyInMap({
                        ...commonArgs,
                        map: currentMap,
                        missingKey: key,
                    }),
                ),
            ),
        );
        const parsedScript = parseScript(validStringScalars);
        if (isParsingResultOnlyErrors(parsedScript)) {
            errors.push(...parsedScript);
            continue;
        }

        errors.push(...parsedScript.errors);
        scripts.push(parsedScript.result);
    }

    return {
        result: scripts,
        errors,
    };
}

function parseScript(
    validStringScalars: WithKeyKeyRangeAndValueRange<string>[],
): ParsingResult<ParsedScript> {
    const collectedErrors: YamlParsingError[] = [];
    const maybeUntypedTypeWithKeyRange = validStringScalars.find(
        ({ key }) => key == ScriptMapProperty.Type,
    );
    const maybeCodeWithKeyRange = validStringScalars.find(
        ({ key }) => key == ScriptMapProperty.Code,
    );

    if (!maybeUntypedTypeWithKeyRange) {
        return collectedErrors;
    }

    const maybeTypedType = getTypedValueFromList(
        {
            allowedValues: Object.values(ScriptType),
            allStringValues: [maybeUntypedTypeWithKeyRange],
            keyName: ScriptMapProperty.Type,
        },
        collectedErrors,
    );

    return maybeCodeWithKeyRange && maybeTypedType
        ? {
              errors: collectedErrors,
              result: {
                  code: stripKeyFromResult(maybeCodeWithKeyRange),
                  type: maybeTypedType.value,
              },
          }
        : collectedErrors;
}
