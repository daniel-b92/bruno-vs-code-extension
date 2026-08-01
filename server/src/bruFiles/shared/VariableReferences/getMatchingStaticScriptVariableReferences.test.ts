import { expect, test } from "@jest/globals";
import {
    BrunoVariableReference,
    BrunoVariableType,
    VariableAvailabilityScopes,
    VariableReferenceType,
    RequestFileBlockName,
} from "@global_shared";
import { getMatchingStaticScriptVariableReferences } from "./getMatchingStaticScriptVariableReferences";

test("filters only matching static script references for the active block", () => {
    const sameFileReference = getDefaultReference("from-own-file");
    const ignoredReadReference: BrunoVariableReference = {
        ...getDefaultReference("ignored1"),
        referenceType: VariableReferenceType.Read,
    };
    const ignoredDynamicReference: BrunoVariableReference = {
        ...getDefaultReference("ignored2"),
        variableType: BrunoVariableType.Runtime,
    };
    const ignoredWrongScopeReference: BrunoVariableReference = {
        ...getDefaultReference("ignored3"),
        scope: VariableAvailabilityScopes.PostResponseScriptForOwnItemAndDescendants,
    };
    const ignoredDifferentTypeReference: BrunoVariableReference = {
        ...getDefaultReference("ignored4"),
        variableType: BrunoVariableType.Global,
    };

    const otherFileReference: BrunoVariableReference = {
        ...getDefaultReference("from-other-file"),
    };

    const result = getMatchingStaticScriptVariableReferences(
        createRequestContext(
            "/tmp/current/folder.bru",
            [
                sameFileReference,
                ignoredReadReference,
                ignoredDynamicReference,
                ignoredWrongScopeReference,
                ignoredDifferentTypeReference,
            ],
            [
                {
                    path: "/tmp/ancestor/folder.bru",
                    references: [otherFileReference],
                },
            ],
        ),
        BrunoVariableType.Folder,
    );

    expect(result).toHaveLength(2);
    expect(
        result
            .map(
                ({ mostRelevantReference }) =>
                    mostRelevantReference.reference.variableName,
            )
            .sort(),
    ).toEqual(["from-own-file", "from-other-file"].sort());
});

test("prefers the closest matching reference when equivalent refs appear in multiple files", () => {
    const sameFileReference = getDefaultReference("apiKey");
    const ancestorReference = getDefaultReference("apiKey");
    const nestedAncestorReference = getDefaultReference("apiKey");

    const result = getMatchingStaticScriptVariableReferences(
        createRequestContext(
            "/tmp/current/folder.bru",
            [sameFileReference],
            [
                {
                    path: "/tmp/ancestor/folder.bru",
                    references: [ancestorReference],
                },
                {
                    path: "/tmp/very/deep/ancestor/folder.bru",
                    references: [nestedAncestorReference],
                },
            ],
        ),
        BrunoVariableType.Folder,
    );

    expect(result).toHaveLength(1);
    expect(result[0].mostRelevantReference.reference.variableName).toBe(
        "apiKey",
    );
    expect(result[0].mostRelevantReference.path.absolute).toBe(
        "/tmp/current/folder.bru",
    );
    expect(result[0].mostRelevantReference.indirectionLevel).toBe(0);
    expect(result[0].otherMatchingReferences).toHaveLength(2);
});

function getDefaultReference(variableName: string): BrunoVariableReference {
    return {
        variableName,
        variableNameRange: {} as never,
        variableType: BrunoVariableType.Folder,
        referenceType: VariableReferenceType.Write,
        scope: VariableAvailabilityScopes.PreRequestScriptForOwnItemAndDescendants,
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
