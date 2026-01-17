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
    canUseNpx: boolean;
    useDeveloperSandbox: boolean;
    reportingAndOptionalData: TestRunReportingAndOptionalData;
}

export interface TestRunReportingAndOptionalData {
    htmlReportPath: string;
    testEnvironment?: string;
    logger?: OutputChannelLogger;
    userInput?: TestRunUserInputData;
}
