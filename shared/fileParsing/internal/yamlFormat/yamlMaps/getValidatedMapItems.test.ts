import { describe, it, expect } from "@jest/globals";
import {
    makeCommonParsingArgs,
    parseTextIntoYamlDocument,
} from "../../../../_testingUtils";
import { YamlParsingError, YamlParsingErrorCode } from "../../../..";
import { YAMLMap } from "yaml";
import { getValidatedMapItems } from "./getValidatedMapItems";

describe("getValidatedMapItems", () => {
    it("adds an error for a missing mandatory key and marks it as mandatory", () => {
        const { errors, missingProperties } = run("other: foo", {
            scalars: { stringValues: ["name", "other"] },
            mandatoryKeys: ["name"],
        });

        expect(errors).toHaveLength(1);
        expect(errors[0].code).toBe(YamlParsingErrorCode.ItemDoesNotExist);
        expect(missingProperties).toEqual([
            { key: "name", alwaysHasScalarValue: true, isMandatory: true },
        ]);
    });

    it("does not add an error for missing optional keys", () => {
        const { errors, missingProperties } = run("name: foo", {
            scalars: { stringValues: ["name"] },
            sequenceValues: ["items"],
            mandatoryKeys: ["name"],
        });

        expect(errors).toEqual([]);
        expect(missingProperties).toEqual([
            { key: "items", alwaysHasScalarValue: false, isMandatory: false },
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

    it("does not mark a key as always scalar if it can also be a map", () => {
        const { missingProperties } = run("other: foo", {
            scalars: { stringValues: ["auth", "other"] },
            mapValues: ["auth"],
        });

        expect(missingProperties).toEqual([
            { key: "auth", alwaysHasScalarValue: false, isMandatory: false },
        ]);
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
});

function run(
    documentText: string,
    expectedKeys: Parameters<typeof getValidatedMapItems>[1],
    collectedErrors: YamlParsingError[] = [],
) {
    const map = parseTextIntoYamlDocument(documentText).contents as YAMLMap;
    const result = getValidatedMapItems(
        map,
        expectedKeys,
        makeCommonParsingArgs(documentText),
        collectedErrors,
    );
    return { ...result, errors: collectedErrors };
}
