import { describe, expect, it } from "@jest/globals";
import { BlockRuntimeExecutionGroup, VariableScopeSectionKind } from "../../..";
import {
    getScriptSectionForScriptVarsSection,
    getSectionRuntimeExecutionGroup,
    getSectionsWithEarlierExecutionGroups,
    getSectionsWithLaterExecutionGroups,
    hasVariableSupport,
    isCodeSection,
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

    it("maps script vars sections to the scripts that read them", () => {
        expect(
            isScriptVarsSection(VariableScopeSectionKind.PreRequestVars),
        ).toBe(true);
        expect(isScriptVarsSection(VariableScopeSectionKind.Request)).toBe(
            false,
        );
        expect(
            getScriptSectionForScriptVarsSection(
                VariableScopeSectionKind.PreRequestVars,
            ),
        ).toBe(VariableScopeSectionKind.PreRequestScript);
        expect(
            getScriptSectionForScriptVarsSection(
                VariableScopeSectionKind.PostResponseVars,
            ),
        ).toBe(VariableScopeSectionKind.PostResponseScript);
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
