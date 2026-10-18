import { describe, it, expect } from "@jest/globals";
import {
    getMissingKeys,
    makeCommonParsingArgs,
    parseTextIntoYamlDocument,
} from "../../../../_testingUtils";
import {
    Position,
    Range,
    YamlParsingError,
    YamlParsingErrorCode,
} from "../../../..";
import { YAMLMap } from "yaml";
import { getValidatedMapItems } from "./getValidatedMapItems";

describe("getValidatedMapItems", () => {
    it("adds an error for a missing mandatory key and marks it as mandatory in the descriptor", () => {
        const { errors, descriptor } = run("other: foo", {
            scalars: { stringValues: ["name", "other"] },
            mandatoryKeys: ["name"],
        });

        expect(errors).toHaveLength(1);
        expect(errors[0].code).toBe(YamlParsingErrorCode.ItemDoesNotExist);
        expect(getMissingKeys(descriptor)).toEqual([
            { key: "name", valueKinds: ["string"], isMandatory: true },
        ]);
    });

    it("does not add an error for missing optional keys", () => {
        const { errors, descriptor } = run("name: foo", {
            scalars: { stringValues: ["name"] },
            sequenceValues: ["items"],
            mandatoryKeys: ["name"],
        });

        expect(errors).toEqual([]);
        expect(getMissingKeys(descriptor)).toEqual([
            { key: "items", valueKinds: ["sequence"], isMandatory: false },
        ]);
    });

    it("adds an error listing all allowed keys for an unknown key", () => {
        const { errors } = run("unknown: foo", {
            scalars: { stringValues: ["name"] },
            mapValues: ["details"],
            sequenceValues: ["items"],
        });

        expect(errors).toHaveLength(1);
        expect(errors[0].code).toBe(YamlParsingErrorCode.UnknownFieldInMap);
        for (const allowedKey of ["name", "details", "items"]) {
            expect(errors[0].message).toContain(allowedKey);
        }
    });

    it("lists all value kinds of a key in the descriptor", () => {
        const { descriptor } = run("other: foo", {
            scalars: { stringValues: ["auth", "other"] },
            mapValues: ["auth"],
        });

        expect(getMissingKeys(descriptor)).toEqual([
            { key: "auth", valueKinds: ["string", "map"], isMandatory: false },
        ]);
    });

    it("lists all defined keys in the descriptor, including unknown ones and ones with an invalid value", () => {
        const { descriptor } = run("name: 5\nunknown: foo\nflag: true", {
            scalars: { stringValues: ["name"], booleanValues: ["flag"] },
        });

        expect(descriptor.definedKeys.map(({ key }) => key)).toEqual([
            "name",
            "unknown",
            "flag",
        ]);
        expect(descriptor.definedKeys[0].keyRange).toEqual(
            new Range(new Position(0, 0), new Position(0, 4)),
        );
        expect(descriptor.definedKeys[0].valueRange).toEqual(
            new Range(new Position(0, 6), new Position(0, 7)),
        );
    });

    it("includes additionally allowed keys with their value kinds, but not silently allowed ones", () => {
        const { errors, descriptor } = run("extra: foo\nhidden: bar", {
            scalars: { stringValues: ["name"] },
            additionalAllowedKeys: [
                { key: "extra", valueKinds: ["string", "map"] },
            ],
            silentlyAllowedKeys: ["hidden"],
        });

        expect(errors).toEqual([]);
        expect(descriptor.expectedKeys.map(({ key }) => key)).toEqual([
            "name",
            "extra",
        ]);
        expect(descriptor.expectedKeys[1].valueKinds).toEqual([
            "string",
            "map",
        ]);
    });

    it("does not record a descriptor if there is no sink for them", () => {
        const map = parseTextIntoYamlDocument("name: foo").contents as YAMLMap;
        const { mapDescriptors, ...commonArgs } =
            makeCommonParsingArgs("name: foo");

        getValidatedMapItems(
            map,
            { scalars: { stringValues: ["name"] } },
            commonArgs,
            [],
        );

        expect(mapDescriptors).toEqual([]);
    });

    describe("enum values", () => {
        it("returns the value if it is one of the allowed values and lists them in the descriptor", () => {
            const { errors, getEnumValue, descriptor } = run("type: b", {
                scalars: { enumValues: { type: ["a", "b"] } },
            });

            expect(errors).toEqual([]);
            expect(getEnumValue("type")?.value).toBe("b");
            expect(descriptor.expectedKeys).toEqual([
                {
                    key: "type",
                    valueKinds: ["string"],
                    isMandatory: false,
                    allowedValues: ["a", "b"],
                },
            ]);
        });

        it("adds an error and returns undefined for a value that is not allowed", () => {
            const { errors, getEnumValue } = run("type: c", {
                scalars: { enumValues: { type: ["a", "b"] } },
            });

            // The error is added when the value is requested.
            expect(errors).toHaveLength(0);
            expect(getEnumValue("type")).toBeUndefined();
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toContain("Invalid value 'c'");
        });

        it("returns undefined for a missing key", () => {
            const { getEnumValue } = run("other: c", {
                scalars: {
                    stringValues: ["other"],
                    enumValues: { type: ["a"] },
                },
            });

            expect(getEnumValue("type")).toBeUndefined();
        });
    });

    it("appends to the provided errors instead of replacing them", () => {
        const existingError: YamlParsingError = {
            message: "existing",
            range: makeCommonParsingArgs("").fullDocumentRange,
            code: YamlParsingErrorCode.Other,
        };

        const { errors } = run(
            "unknown: foo",
            { scalars: { stringValues: ["name"] } },
            [existingError],
        );

        expect(errors).toHaveLength(2);
        expect(errors[0]).toBe(existingError);
    });

    describe("lookup functions", () => {
        it("return the valid item for the key, depending on the value type", () => {
            const { getString, getBoolean, getNumber, getMap, getSequence } =
                run(
                    `name: foo
flag: true
count: 3
details:
    a: b
items:
    - c`,
                    {
                        scalars: {
                            stringValues: ["name"],
                            booleanValues: ["flag"],
                            numericValues: ["count"],
                        },
                        mapValues: ["details"],
                        sequenceValues: ["items"],
                    },
                );

            expect(getString("name")?.value).toBe("foo");
            expect(getBoolean("flag")?.value).toBe(true);
            expect(getNumber("count")?.value).toBe(3);
            expect(getMap("details")?.key).toBe("details");
            expect(getSequence("items")?.key).toBe("items");
        });

        it("return undefined for missing keys and for values of another type", () => {
            const { getString, getBoolean } = run("name: 5", {
                scalars: { stringValues: ["name", "other"], booleanValues: [] },
            });

            expect(getString("name")).toBeUndefined();
            expect(getString("other")).toBeUndefined();
            expect(getBoolean("name")).toBeUndefined();
        });
    });
});

function run(
    documentText: string,
    expectedKeys: Parameters<typeof getValidatedMapItems>[1],
    collectedErrors: YamlParsingError[] = [],
) {
    const map = parseTextIntoYamlDocument(documentText).contents as YAMLMap;
    const commonArgs = makeCommonParsingArgs(documentText);
    const result = getValidatedMapItems(
        map,
        expectedKeys,
        commonArgs,
        collectedErrors,
    );
    return {
        ...result,
        errors: collectedErrors,
        descriptor: commonArgs.mapDescriptors[0],
    };
}
