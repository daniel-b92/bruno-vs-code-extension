import { BrunoVariableReference, Range } from "../../..";

/**
 * Describes the role that a section of a file has regarding the usage of variables.
 * It is independent of the file format (e.g. a `script:pre-request` block in a Bru file and a `before-request` script in a Yaml file are both a `PreRequestScript`).
 */
export enum VariableScopeSectionKind {
    PreRequestScript = 1,
    PostResponseScript,
    Tests,
    GrpcBeforeCallStartScript,
    GrpcBeforeMessageSendScript,
    GrpcAfterMessageReceiveScript,
    GrpcAfterCallEndScript,
    PreRequestVars,
    PostResponseVars,
    Assertions,
    /** E.g. url, headers, params, body or auth. */
    Request,
    /** E.g. docs, meta/info or settings. */
    NoVariableSupport,
}

export interface VariableScopeSection {
    kind: VariableScopeSectionKind;
    /** A human-readable name that is used for displaying the section to the user. */
    name: string;
    range: Range;
    variableReferences: BrunoVariableReference[];
}
