import { YAMLMap } from "yaml";
import { YamlMapMissingPropertyInfo, YamlParsingError } from "../../../..";
import { CommonParsingArgs, ParsedMapItems } from "../interfaces";
import { getErrorForMissingKeyInMap } from "../parsingErrors/getErrorForMissingKeyInMap";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { ExpectedKeys, getMapItems } from "./getMapItems";

/**
 * Wraps {@link getMapItems} and additionally handles the validation that is common to all Yaml maps:
 * - Adds an error for every unknown key.
 * - Adds an error for every missing mandatory key.
 * - Derives the info about missing properties from the expected keys.
 *
 * All errors are appended to `collectedErrors`.
 *
 * @param mandatoryKeys Keys that have to be defined. All other expected keys are optional.
 */
export function getValidatedMapItems(
    map: YAMLMap,
    expectedKeys: ExpectedKeys & { mandatoryKeys?: string[] },
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
): { items: ParsedMapItems; missingProperties: YamlMapMissingPropertyInfo[] } {
    const { mandatoryKeys = [], ...keysForParsing } = expectedKeys;
    const { items, errors } = getMapItems(map, keysForParsing, commonArgs);
    const { unknownKeys, missingKeys } = items;

    const allowedKeys = [
        ...new Set([
            ...Object.values(keysForParsing.scalars ?? {}).flatMap(
                (keys) => keys ?? [],
            ),
            ...(keysForParsing.mapValues ?? []),
            ...(keysForParsing.sequenceValues ?? []),
        ]),
    ];
    // Keys that can only have a scalar value (and not also a map or sequence).
    const nonScalarKeys = [
        ...(keysForParsing.mapValues ?? []),
        ...(keysForParsing.sequenceValues ?? []),
    ];

    collectedErrors.push(
        ...errors,
        ...unknownKeys.map(({ key: unknownKey, keyRange }) =>
            getErrorForUnknownKeyInMap({
                ...commonArgs,
                unknownKey,
                keyRange,
                allowedKeys,
            }),
        ),
        ...missingKeys
            .filter((key) => mandatoryKeys.includes(key))
            .map((missingKey) =>
                getErrorForMissingKeyInMap({ ...commonArgs, missingKey, map }),
            ),
    );

    return {
        items,
        missingProperties: missingKeys.map((key) => ({
            key,
            alwaysHasScalarValue: !nonScalarKeys.includes(key),
            isMandatory: mandatoryKeys.includes(key),
        })),
    };
}
