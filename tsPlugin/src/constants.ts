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

/**
 * Older versions of the VS Code extension created a temporary file with this name in the collections for providing the runtime definitions.
 * They are ignored by the plugin, since the definitions are provided via a virtual file now.
 */
export function getTempJsFileBaseNameWithoutExtension() {
    return "__temp_bru_reference";
}

export function isTempJsFile(fileName: string) {
    return basename(fileName).startsWith(
        getTempJsFileBaseNameWithoutExtension(),
    );
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
 *
 * TODO: Remove this special treatment of leftover temporary js files at some point in the future, once versions of the extension that created them are no longer in use. (Only the part for the leftover temporary js files.)
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

/**
 * Only the type that is relevant for the plugin.
 * Same as `FileInfoType` for Yaml files in the shared folder of the extension.
 */
export enum FileInfoType {
    Grpc = "grpc",
}

/**
 * Same as `InbuiltFunctionName` in the shared folder of the extension.
 * The first parameter of these functions is the name of a variable, for which the extension provides hovers and completions itself.
 */
export function getNamesForInbuiltFunctionsWithVariableName() {
    return [
        "getGlobalEnvVar",
        "setGlobalEnvVar",
        "getEnvVar",
        "setEnvVar",
        "deleteEnvVar",
        "getVar",
        "setVar",
        "getRequestVar",
        "getFolderVar",
    ];
}
