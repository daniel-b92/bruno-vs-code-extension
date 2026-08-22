import { YAMLSeq } from "yaml";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedScript,
    WithKeyKeyRangeAndValueRange,
    YamlMapMissingPropertyInfo,
} from "../interfaces";
import { WithKeyAndValueRange, YamlParsingError } from "../../../..";
import { getYamlMapsFromSequence } from "../yamlSequences/getYamlMapsFromSequence";
import { getMapItems } from "../yamlMaps/getMapItems";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { getErrorForMissingKeyInMap } from "../parsingErrors/getErrorForMissingKeyInMap";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";
import { ScriptType } from "./constants/sharedConstants";
import { getRangeForItem } from "../util/getRangeForItem";

enum ScriptMapProperty {
    Type = "type",
    Code = "code",
}

export function parseScriptsFromYamlSequence(
    scriptsSequence: YAMLSeq,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedScript[]> {
    const scripts: ParsedScript[] = [];
    const errors: YamlParsingError[] = [];

    const { items: scriptMaps, errors: sequenceParsingErrors } =
        getYamlMapsFromSequence({
            ...commonArgs,
            sequence: scriptsSequence,
        });
    errors.push(...sequenceParsingErrors);

    const keysForStringScalars = Object.values(ScriptMapProperty);

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
        const { errors: parsingErrors, result: parsedScript } = parseScript(
            validStringScalars,
            missingKeys,
        );
        errors.push(...parsingErrors);

        if (!parsedScript) {
            continue;
        }

        const { missingProperties, code, type } = parsedScript;
        scripts.push({
            missingProperties,
            properties: { code, type },
            valueRange: getRangeForItem(currentMap, commonArgs),
        });
    }

    return {
        result: scripts,
        errors,
    };
}

function parseScript(
    validStringScalars: WithKeyKeyRangeAndValueRange<string>[],
    missingKeys: string[],
): MaybeResultWithErrors<{
    type?: WithKeyAndValueRange<ScriptType>;
    code?: WithKeyAndValueRange<string>;
    missingProperties: YamlMapMissingPropertyInfo[];
}> {
    const collectedErrors: YamlParsingError[] = [];
    const missingProperties = missingKeys.map((key) => ({
        alwaysHasScalarValue: true,
        isMandatory: true,
        key,
    }));
    const maybeUntypedTypeWithKeyRange = validStringScalars.find(
        ({ key }) => key == ScriptMapProperty.Type,
    );
    const maybeCodeWithKeyRange = validStringScalars.find(
        ({ key }) => key == ScriptMapProperty.Code,
    );

    const maybeTypedType = !maybeUntypedTypeWithKeyRange
        ? undefined
        : getTypedValueFromList(
              {
                  allowedValues: Object.values(ScriptType),
                  allStringValues: [maybeUntypedTypeWithKeyRange],
                  keyName: ScriptMapProperty.Type,
              },
              collectedErrors,
          );

    return {
        errors: collectedErrors,
        result: {
            code: maybeCodeWithKeyRange
                ? stripKeyFromResult(maybeCodeWithKeyRange)
                : undefined,
            type: maybeTypedType?.value,
            missingProperties,
        },
    };
}
