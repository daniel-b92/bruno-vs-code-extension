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

export interface TestRunReportingAndOptionalData {
    /** If undefined, no HTML report is generated. */
    htmlReportPath?: string;
    /** Whether the HTML report is stored at a location the user configured (as opposed to the extension's own storage). */
    isHtmlReportPathConfiguredByUser?: boolean;
    testEnvironment?: string;
    logger?: OutputChannelLogger;
    userInput?: TestRunUserInputData;
}
