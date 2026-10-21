import {
    BlockRuntimeExecutionGroup,
    VariableScopeSection,
    VariableScopeSectionKind,
} from "../../..";

export function getSectionRuntimeExecutionGroup(
    kind: VariableScopeSectionKind,
) {
    return preRequestKinds().includes(kind)
        ? BlockRuntimeExecutionGroup.PreRequest
        : postResponseKinds().includes(kind)
          ? BlockRuntimeExecutionGroup.PostResponse
          : BlockRuntimeExecutionGroup.Request;
}

export function getSectionsWithEarlierExecutionGroups<
    T extends Pick<VariableScopeSection, "kind">,
>(referenceKind: VariableScopeSectionKind, allSections: T[]) {
    const referenceGroup = getSectionRuntimeExecutionGroup(referenceKind);

    return allSections.filter(
        ({ kind }) => getSectionRuntimeExecutionGroup(kind) < referenceGroup,
    );
}

export function getSectionsWithLaterExecutionGroups<
    T extends Pick<VariableScopeSection, "kind">,
>(referenceKind: VariableScopeSectionKind, allSections: T[]) {
    const referenceGroup = getSectionRuntimeExecutionGroup(referenceKind);

    return allSections.filter(
        ({ kind }) => getSectionRuntimeExecutionGroup(kind) > referenceGroup,
    );
}

export function isCodeSection(kind: VariableScopeSectionKind) {
    return codeKinds().includes(kind);
}

export function hasVariableSupport(kind: VariableScopeSectionKind) {
    return kind != VariableScopeSectionKind.NoVariableSupport;
}

/** Sections in which variables can only be set, but not read. */
export function isScriptVarsSection(
    kind: VariableScopeSectionKind,
): kind is
    | VariableScopeSectionKind.PreRequestVars
    | VariableScopeSectionKind.PostResponseVars {
    return (
        kind == VariableScopeSectionKind.PreRequestVars ||
        kind == VariableScopeSectionKind.PostResponseVars
    );
}

/** The script, in which the variables that are set in the given section can be read. */
export function getScriptSectionForScriptVarsSection(
    kind:
        | VariableScopeSectionKind.PreRequestVars
        | VariableScopeSectionKind.PostResponseVars,
) {
    return kind == VariableScopeSectionKind.PreRequestVars
        ? VariableScopeSectionKind.PreRequestScript
        : VariableScopeSectionKind.PostResponseScript;
}

function preRequestKinds() {
    return [
        VariableScopeSectionKind.PreRequestScript,
        VariableScopeSectionKind.PreRequestVars,
        VariableScopeSectionKind.GrpcBeforeCallStartScript,
        VariableScopeSectionKind.GrpcBeforeMessageSendScript,
    ];
}

function postResponseKinds() {
    return [
        VariableScopeSectionKind.PostResponseScript,
        VariableScopeSectionKind.PostResponseVars,
        VariableScopeSectionKind.GrpcAfterMessageReceiveScript,
        VariableScopeSectionKind.GrpcAfterCallEndScript,
        VariableScopeSectionKind.Tests,
        VariableScopeSectionKind.Assertions,
    ];
}

function codeKinds() {
    return [
        VariableScopeSectionKind.PreRequestScript,
        VariableScopeSectionKind.PostResponseScript,
        VariableScopeSectionKind.Tests,
        VariableScopeSectionKind.GrpcBeforeCallStartScript,
        VariableScopeSectionKind.GrpcBeforeMessageSendScript,
        VariableScopeSectionKind.GrpcAfterMessageReceiveScript,
        VariableScopeSectionKind.GrpcAfterCallEndScript,
    ];
}
