export enum CollectionFormat {
    Bru = "bru",
    Yaml = "yaml",
}

export enum CodeBlockName {
    Tests = "tests",
    PreRequestScript = "script:pre-request",
    PostResponseScript = "script:post-response",
    GrpcBeforeCallStartScript = "script:grpc:before-call-start",
    GrpcBeforeMessageSendScript = "script:grpc:before-message-send",
    GrpcAfterMessageReceiveScript = "script:grpc:after-message-receive",
    GrpcAfterCallEndScript = "script:grpc:after-call-end",
}

export function getTempJsFileBaseNameWithoutExtension() {
    return "__temp_bru_reference";
}

export function getNamesForInbuiltRuntimeVarsAndFunctions() {
    return ["bru", "req", "res", "test", "expect"];
}

/**
 * Same as `ScriptType` for Yaml files in the shared folder of the extension.
 */
export enum ScriptType {
    BeforeRequest = "before-request",
    AfterResponse = "after-response",
    Tests = "tests",
}
