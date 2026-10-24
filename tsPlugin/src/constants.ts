import { basename } from "path";

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

/**
 * Virtual file that is added to the Typescript project for each collection (see `provideRuntimeDefinitions`).
 * It does not exist on the disk.
 */
export function getRuntimeDefinitionsFileName() {
    return "__bruno_runtime_definitions.js";
}

export function isRuntimeDefinitionsFile(fileName: string) {
    return basename(fileName) == getRuntimeDefinitionsFileName();
}

/**
 * Files that are not meant to be seen by users, since they only exist to provide types for the inbuilt runtime functions.
 */
export function isTempJsFileOrRuntimeDefinitionsFile(fileName: string) {
    return (
        fileName.includes(getTempJsFileBaseNameWithoutExtension()) ||
        isRuntimeDefinitionsFile(fileName)
    );
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
