import { describe, expect, it } from "@jest/globals";
import {
    BlockRuntimeExecutionGroup,
    BrunoFileType,
    BrunoVariableType,
    VariableAvailabilityScopes,
    VariableScopeSectionKind,
} from "../../..";
import {
    getScriptSectionsForPreRequestVars,
    getSectionRuntimeExecutionGroup,
    getSectionsWithEarlierExecutionGroups,
    getSectionsWithLaterExecutionGroups,
    hasVariableSupport,
    isCodeSection,
    getVariableTypeAndScopeForScriptVars,
    isScriptVarsSection,
} from "./variableScopeSectionHelpers";

describe("variableScopeSectionHelpers", () => {
    it.each([
        [
            VariableScopeSectionKind.PreRequestScript,
            BlockRuntimeExecutionGroup.PreRequest,
        ],
        [
            VariableScopeSectionKind.PreRequestVars,
            BlockRuntimeExecutionGroup.PreRequest,
        ],
        [VariableScopeSectionKind.Request, BlockRuntimeExecutionGroup.Request],
        [
            VariableScopeSectionKind.PostResponseVars,
            BlockRuntimeExecutionGroup.PostResponseVars,
        ],
        [
            VariableScopeSectionKind.PostResponseScript,
            BlockRuntimeExecutionGroup.PostResponse,
        ],
        [
            VariableScopeSectionKind.Tests,
            BlockRuntimeExecutionGroup.PostResponse,
        ],
        [
            VariableScopeSectionKind.Assertions,
            BlockRuntimeExecutionGroup.PostResponse,
        ],
    ])("determines the execution group for kind %s", (kind, expected) => {
        expect(getSectionRuntimeExecutionGroup(kind)).toBe(expected);
    });

    it("filters sections by execution group", () => {
        const sections = [
            { kind: VariableScopeSectionKind.PreRequestScript },
            { kind: VariableScopeSectionKind.Request },
            { kind: VariableScopeSectionKind.PostResponseVars },
        ];

        expect(
            getSectionsWithEarlierExecutionGroups(
                VariableScopeSectionKind.Request,
                sections,
            ),
        ).toEqual([sections[0]]);
        expect(
            getSectionsWithLaterExecutionGroups(
                VariableScopeSectionKind.Request,
                sections,
            ),
        ).toEqual([sections[2]]);
    });

    it("identifies script vars sections", () => {
        expect(
            isScriptVarsSection(VariableScopeSectionKind.PreRequestVars),
        ).toBe(true);
        expect(
            isScriptVarsSection(VariableScopeSectionKind.PostResponseVars),
        ).toBe(true);
        expect(isScriptVarsSection(VariableScopeSectionKind.Request)).toBe(
            false,
        );
    });

    it("provides the pre-request vars to all kinds of scripts", () => {
        expect(getScriptSectionsForPreRequestVars().sort()).toEqual(
            [
                VariableScopeSectionKind.PreRequestScript,
                VariableScopeSectionKind.PostResponseScript,
                VariableScopeSectionKind.Tests,
                VariableScopeSectionKind.GrpcBeforeCallStartScript,
                VariableScopeSectionKind.GrpcBeforeMessageSendScript,
                VariableScopeSectionKind.GrpcAfterMessageReceiveScript,
                VariableScopeSectionKind.GrpcAfterCallEndScript,
            ].sort(),
        );
    });

    it("treats post-response vars as runtime variables and pre-request vars as request or folder variables", () => {
        expect(
            getVariableTypeAndScopeForScriptVars(
                VariableScopeSectionKind.PostResponseVars,
                BrunoFileType.RequestFile,
            ),
        ).toEqual({ variableType: BrunoVariableType.Runtime });
        expect(
            getVariableTypeAndScopeForScriptVars(
                VariableScopeSectionKind.PostResponseVars,
                BrunoFileType.FolderSettingsFile,
            ),
        ).toEqual({ variableType: BrunoVariableType.Runtime });
        expect(
            getVariableTypeAndScopeForScriptVars(
                VariableScopeSectionKind.PreRequestVars,
                BrunoFileType.RequestFile,
            ),
        ).toEqual({
            variableType: BrunoVariableType.Request,
            scope: VariableAvailabilityScopes.PreRequestScriptForOwnItemAndDescendants,
        });
        expect(
            getVariableTypeAndScopeForScriptVars(
                VariableScopeSectionKind.PreRequestVars,
                BrunoFileType.CollectionSettingsFile,
            ),
        ).toEqual({
            variableType: BrunoVariableType.Folder,
            scope: VariableAvailabilityScopes.PreRequestScriptForOwnItemAndDescendants,
        });
    });

    it("identifies code sections and sections without variable support", () => {
        expect(isCodeSection(VariableScopeSectionKind.Tests)).toBe(true);
        expect(isCodeSection(VariableScopeSectionKind.Assertions)).toBe(false);
        expect(
            hasVariableSupport(VariableScopeSectionKind.NoVariableSupport),
        ).toBe(false);
        expect(hasVariableSupport(VariableScopeSectionKind.Request)).toBe(true);
    });
});
