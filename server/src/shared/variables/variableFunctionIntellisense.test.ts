import { describe, expect, it } from "@jest/globals";
import {
    BrunoRequestFile,
    CollectionFormat,
    VariableReferenceType,
} from "@global_shared";
import { getHoverText } from "@global_shared/_testingUtils";
import {
    CURSOR,
    requestCompletions,
    requestHover,
    toTestFile,
} from "../_testingUtils/languageRequestTestUtils";

const functions = [
    {
        functionName: "hasEnvVar",
        setter: "setEnvVar",
        referenceType: VariableReferenceType.Read,
    },
    {
        functionName: "hasVar",
        setter: "setVar",
        referenceType: VariableReferenceType.Read,
    },
    {
        functionName: "hasGlobalEnvVar",
        setter: "setGlobalEnvVar",
        referenceType: VariableReferenceType.Read,
    },
    {
        functionName: "deleteGlobalEnvVar",
        setter: "setGlobalEnvVar",
        referenceType: VariableReferenceType.Delete,
    },
];

const writeFunctions = [
    { setter: "setEnvVar", reader: "getEnvVar", deleter: "deleteEnvVar" },
    { setter: "setVar", reader: "getVar", deleter: "deleteVar" },
    {
        setter: "setGlobalEnvVar",
        reader: "getGlobalEnvVar",
        deleter: "deleteGlobalEnvVar",
    },
];

describe.each([CollectionFormat.Bru, CollectionFormat.Yaml])(
    "variable function intellisense in %s files",
    (format) => {
        it.each(functions)(
            "completes variable names for bru.$functionName",
            async ({ functionName, setter, referenceType }) => {
                const result = await requestCompletions(
                    format,
                    getFile(
                        format,
                        `bru.${setter}("token", "value");`,
                        `bru.${functionName}("${CURSOR}");`,
                    ),
                );

                expect(result?.map(({ label }) => label)).toEqual(["token"]);
                if (referenceType == VariableReferenceType.Delete) {
                    expect(result?.[0].labelDetails?.description).toContain(
                        "Delete",
                    );
                }
            },
        );

        it.each(functions)(
            "shows the earlier write when hovering bru.$functionName",
            ({ functionName, setter }) => {
                const result = requestHover(
                    format,
                    getFile(
                        format,
                        `bru.${setter}("token", "value");`,
                        `bru.${functionName}("to${CURSOR}ken");`,
                    ),
                );

                expect(getHoverText(result)).toContain("Dynamic references");
                expect(getHoverText(result)).toContain("| `Write` |");
            },
        );

        it.each(functions)(
            "lists bru.$functionName as a $referenceType when hovering its write",
            ({ functionName, setter, referenceType }) => {
                const result = requestHover(
                    format,
                    getFile(
                        format,
                        `bru.${setter}("to${CURSOR}ken", "value");`,
                        `bru.${functionName}("token");`,
                    ),
                );

                expect(getHoverText(result)).toContain(
                    `| \`${referenceType}\` |`,
                );
            },
        );

        it.each(writeFunctions)(
            "does not complete bru.$setter from a deletion in the same request",
            async ({ setter, deleter }) => {
                const result = await requestCompletions(
                    format,
                    getFile(
                        format,
                        `bru.${setter}("${CURSOR}", "value");`,
                        `bru.${deleter}("deleted");`,
                    ),
                );

                expect(result?.map(({ label }) => label)).toEqual([]);
            },
        );

        it.each(writeFunctions)(
            "completes bru.$setter only once for a read and deletion in the same request",
            async ({ setter, reader, deleter }) => {
                const result = await requestCompletions(
                    format,
                    getFile(
                        format,
                        `bru.${setter}("${CURSOR}", "value");`,
                        `bru.${reader}("token"); bru.${deleter}("token");`,
                    ),
                );

                expect(result?.map(({ label }) => label)).toEqual(["token"]);
            },
        );

        it.each(writeFunctions)(
            "does not complete bru.$setter from a deletion in a following request",
            async ({ setter, deleter }) => {
                const result = await requestCompletions(
                    format,
                    getFile(format, `bru.${setter}("${CURSOR}", "value");`, ""),
                    [
                        getFile(
                            format,
                            `bru.${deleter}("deleted");`,
                            "",
                            "delete",
                            2,
                        ),
                    ],
                );

                expect(result?.map(({ label }) => label)).toEqual([]);
            },
        );

        it.each(writeFunctions)(
            "completes bru.$setter only once for reads and deletions in following requests",
            async ({ setter, reader, deleter }) => {
                const result = await requestCompletions(
                    format,
                    getFile(format, `bru.${setter}("${CURSOR}", "value");`, ""),
                    [
                        getFile(
                            format,
                            `bru.${reader}("token");`,
                            "",
                            "read",
                            2,
                        ),
                        getFile(
                            format,
                            `bru.${deleter}("token");`,
                            "",
                            "delete",
                            3,
                        ),
                    ],
                );

                expect(result?.map(({ label }) => label)).toEqual(["token"]);
            },
        );

        it.each(writeFunctions)(
            "keeps reads and deletions in following requests visible when hovering bru.$setter",
            ({ setter, reader, deleter }) => {
                const result = requestHover(
                    format,
                    getFile(
                        format,
                        `bru.${setter}("to${CURSOR}ken", "value");`,
                        "",
                    ),
                    [
                        getFile(
                            format,
                            `bru.${reader}("token");`,
                            "",
                            "read",
                            2,
                        ),
                        getFile(
                            format,
                            `bru.${deleter}("token");`,
                            "",
                            "delete",
                            3,
                        ),
                    ],
                );

                expect(getHoverText(result)).toContain("| `Read` |");
                expect(getHoverText(result)).toContain("| `Delete` |");
            },
        );
    },
);

function getFile(
    format: CollectionFormat,
    before: string,
    after: string,
    requestName = "request",
    sequence = 1,
) {
    let text: string;
    let filePath: string;
    switch (format) {
        case CollectionFormat.Bru:
            filePath = `/collection/${requestName}.bru`;
            text = `script:pre-request {
  ${before}
}
script:post-response {
  ${after}
}
`;
            break;
        case CollectionFormat.Yaml:
            filePath = `/collection/${requestName}.yml`;
            text = `runtime:
  scripts:
    - type: before-request
      code: |
        ${before}
    - type: after-response
      code: |
        ${after}
`;
            break;
        default:
            throw new Error("Unsupported collection format");
    }
    return toTestFile({
        item: new BrunoRequestFile(filePath, sequence),
        content: text,
    });
}
