import { expect, test } from "@jest/globals";
import {
    BrunoVariableReference,
    BrunoVariableType,
    VariableAvailabilityScope,
    VariableAvailabilityScopes,
    VariableReferenceType,
    RequestFileBlockName,
} from "@global_shared";
import { getMatchingStaticScriptVariableReferences } from "./getMatchingStaticScriptVariableReferences";

test("filters only matching static script references for the active block", () => {
    const sameFileReference = createReference("apiKey");
    const ignoredReadReference = createReference(
        "apiKey",
        BrunoVariableType.Environment,
        VariableReferenceType.Read,
    );
    const ignoredDynamicReference = createReference(
        "apiKey",
        BrunoVariableType.Environment,
        VariableReferenceType.Write,
        undefined,
    );
    const ignoredWrongScopeReference = createReference(
        "apiKey",
        BrunoVariableType.Environment,
        VariableReferenceType.Write,
        VariableAvailabilityScopes.PostResponseScriptForOwnItemAndDescendants,
    );
    const ignoredDifferentTypeReference = createReference(
        "apiKey",
        BrunoVariableType.Global,
        VariableReferenceType.Write,
    );

    const otherFileReference = createReference("sharedToken");

    const result = getMatchingStaticScriptVariableReferences(
        createRequestContext(
            "/tmp/current/request.bru",
            [
                sameFileReference,
                ignoredReadReference,
                ignoredDynamicReference,
                ignoredWrongScopeReference,
                ignoredDifferentTypeReference,
            ],
            [
                {
                    path: "/tmp/ancestor/request.bru",
                    references: [otherFileReference],
                },
            ],
        ),
        BrunoVariableType.Environment,
    );

    expect(result).toHaveLength(2);
    expect(
        result
            .map(
                ({ mostRelevantReference }) =>
                    mostRelevantReference.reference.variableName,
            )
            .sort(),
    ).toEqual(["apiKey", "sharedToken"].sort());
});

test("prefers the closest matching reference when equivalent refs appear in multiple files", () => {
    const sameFileReference = createReference("apiKey");
    const ancestorReference = createReference("apiKey");
    const nestedAncestorReference = createReference("apiKey");

    const result = getMatchingStaticScriptVariableReferences(
        createRequestContext(
            "/tmp/current/request.bru",
            [sameFileReference],
            [
                {
                    path: "/tmp/ancestor/request.bru",
                    references: [ancestorReference],
                },
                {
                    path: "/tmp/very/deep/ancestor/request.bru",
                    references: [nestedAncestorReference],
                },
            ],
        ),
        BrunoVariableType.Environment,
    );

    expect(result).toHaveLength(1);
    expect(result[0].mostRelevantReference.reference.variableName).toBe(
        "apiKey",
    );
    expect(result[0].mostRelevantReference.path.absolute).toBe(
        "/tmp/current/request.bru",
    );
    expect(result[0].mostRelevantReference.indirectionLevel).toBe(0);
    expect(result[0].otherMatchingReferences).toHaveLength(2);
});

function createReference(
    variableName: string,
    variableType: BrunoVariableType = BrunoVariableType.Environment,
    referenceType: VariableReferenceType = VariableReferenceType.Write,
    scope: VariableAvailabilityScope = VariableAvailabilityScopes.PreRequestScriptForOwnItemAndDescendants,
): BrunoVariableReference {
    return {
        variableName,
        variableNameRange: {} as never,
        variableType,
        referenceType,
        scope,
    };
}

function createRequestContext(
    filePath: string,
    variableReferences: BrunoVariableReference[],
    otherFiles: Array<{
        path: string;
        references: BrunoVariableReference[];
    }> = [],
) {
    return {
        request: {
            filePath,
            documentHelper: {} as never,
            position: {} as never,
            token: {} as never,
        },
        file: {
            allBlocks: [
                {
                    name: RequestFileBlockName.PreRequestScript,
                    nameRange: {} as never,
                    content: "",
                    contentRange: {} as never,
                    variableReferences,
                },
            ],
            blockContainingPosition: {
                name: RequestFileBlockName.PreRequestScript,
                nameRange: {} as never,
                content: "",
                contentRange: {} as never,
                variableReferences,
            },
            collection: {
                getCommonAncestorData: () =>
                    otherFiles.map(({ path, references }) => ({
                        item: {
                            getPath: () => path,
                        },
                        additionalData: [
                            {
                                reference: references[0],
                            },
                        ],
                    })),
            },
        },
    } as unknown as Parameters<
        typeof getMatchingStaticScriptVariableReferences
    >[0];
}
