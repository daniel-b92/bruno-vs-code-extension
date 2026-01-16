import { OutputChannelLogger } from "../../shared";

export interface UserInputData {
    includedTags: string[];
    excludedTags: string[];
    otherConfigs: OtherConfigData;
}

export interface OtherConfigData {
    recursive: boolean;
    sandboxModeDeveloper: boolean;
}

export interface ChildProcessData {
    testPath: string;
    collectionRootDirectory: string;
    jsonReportPath: string;
    canUseNpx: boolean;
    reportingAndOptionalData: TestRunReportingAndOptionalData;
}

export interface TestRunReportingAndOptionalData {
    htmlReportPath: string;
    testEnvironment?: string;
    logger?: OutputChannelLogger;
    userInput?: UserInputData;
}
