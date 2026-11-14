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
    },
);

function getFile(format: CollectionFormat, before: string, after: string) {
    let text: string;
    let filePath: string;
    switch (format) {
        case CollectionFormat.Bru:
            filePath = "/collection/request.bru";
            text = `script:pre-request {
  ${before}
}
script:post-response {
  ${after}
}
`;
            break;
        case CollectionFormat.Yaml:
            filePath = "/collection/request.yml";
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
    return toTestFile({ item: new BrunoRequestFile(filePath), content: text });
}
