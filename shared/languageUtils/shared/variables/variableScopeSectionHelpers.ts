import {
    BlockRuntimeExecutionGroup,
    BrunoFileType,
    BrunoVariableType,
    ItemType,
    VariableAvailabilityScopes,
    VariableScopeSection,
    VariableScopeSectionKind,
} from "../../..";

export function getSectionRuntimeExecutionGroup(
    kind: VariableScopeSectionKind,
) {
    return preRequestKinds().includes(kind)
        ? BlockRuntimeExecutionGroup.PreRequest
        : kind == VariableScopeSectionKind.PostResponseVars
          ? BlockRuntimeExecutionGroup.PostResponseVars
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

/**
 * The scripts, in which the variables that are set in a `PreRequestVars` section can be read (via `bru.getRequestVar` / `bru.getFolderVar`).
 * Bruno passes the request and folder variables to all script runtimes (pre-request scripts, post-response scripts, tests and the gRPC scripts).
 */
export function getScriptSectionsForPreRequestVars() {
    return codeKinds();
}

/**
 * Pre-request variables are only available as request or folder variables (depending on the item type).
 * Post-response variables (and `set-variable` actions) are runtime variables, like variables set via `bru.setVar`.
 */
export function getVariableTypeAndScopeForScriptVars(
    kind:
        | VariableScopeSectionKind.PreRequestVars
        | VariableScopeSectionKind.PostResponseVars,
    itemType: ItemType,
):
    | {
          variableType: BrunoVariableType.Runtime;
          scope?: undefined;
      }
    | {
          variableType: BrunoVariableType.Request | BrunoVariableType.Folder;
          scope: typeof VariableAvailabilityScopes.PreRequestScriptForOwnItemAndDescendants;
      } {
    return kind == VariableScopeSectionKind.PostResponseVars
        ? { variableType: BrunoVariableType.Runtime }
        : {
              variableType:
                  itemType == BrunoFileType.RequestFile
                      ? BrunoVariableType.Request
                      : BrunoVariableType.Folder,
              scope: VariableAvailabilityScopes.PreRequestScriptForOwnItemAndDescendants,
          };
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
