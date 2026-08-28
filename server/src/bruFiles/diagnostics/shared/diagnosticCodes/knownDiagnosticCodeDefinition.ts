import { RelevantWithinAuthBlockDiagnosticCode } from "./relevantWithinAuthBlockDiagnosticCodeEnum";
import { RelevantWithinMetaBlockDiagnosticCode } from "./relevantWithinMetaBlockDiagnosticCodeEnum";
import { RelevantWithinMethodBlockDiagnosticCode } from "./relevantWithinMethodBlockDiagnosticCodeEnum";
import { NonBlockSpecificDiagnosticCode } from "./nonBlockSpecificDiagnosticCodeEnum";
import { RelevantWithinBodyBlockDiagnosticCode } from "./relevantWithinBodyBlockDiagnosticCodeEnum";
import { RelevantWithinAuthModeBlockDiagnosticCode } from "./relevantWithinAuthModeBlockDiagnosticCodeEnum";
import { RelevantWithinSettingsBlockDiagnosticCode } from "./relevantWithinSettingsBlockDiagnosticCodeEnum";
import { RelevantWithinEnvironmentFileDiagnosticCode } from "./relevantWithinEnvironmentFileDiagnosticCodeEnum";
import { RelevantWithinAppBlockDiagnosticCode } from "./relevantWithinAppBlockDiagnosticCodeEnum";

export type KnownDiagnosticCode =
    | RelevantWithinAuthBlockDiagnosticCode
    | RelevantWithinMetaBlockDiagnosticCode
    | RelevantWithinMethodBlockDiagnosticCode
    | RelevantWithinBodyBlockDiagnosticCode
    | NonBlockSpecificDiagnosticCode
    | RelevantWithinAuthModeBlockDiagnosticCode
    | RelevantWithinSettingsBlockDiagnosticCode
    | RelevantWithinEnvironmentFileDiagnosticCode
    | RelevantWithinAppBlockDiagnosticCode;
