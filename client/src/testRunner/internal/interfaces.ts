import { OutputChannelLogger } from "../../shared";

export interface TestRunUserInputData {
    includedTags: string[];
    excludedTags: string[];
    otherConfigs: OtherExecutionConfigData;
}

export interface OtherExecutionConfigData {
    recursive: boolean;
    bail: boolean;
    parallel: boolean;
}

export interface TestRunChildProcessData {
    testPath: string;
    collectionRootDirectory: string;
    jsonReportPath: string;
    useDeveloperSandbox: boolean;
    reportingAndOptionalData: TestRunReportingAndOptionalData;
}

export interface HtmlReportLocation {
    path: string;
    /** If false, the report is only stored in the extension's own storage (e.g. to be shown in the report panel). */
    isConfiguredByUser: boolean;
}

export interface TestRunReportingAndOptionalData {
    /** If undefined, no HTML report is generated. */
    htmlReport?: HtmlReportLocation;
    testEnvironment?: string;
    logger?: OutputChannelLogger;
    userInput?: TestRunUserInputData;
}
