import { RelevantWithinAuthBlockDiagnosticCode } from "./relevantWithinAuthBlockDiagnosticCodeEnum";
import { RelevantWithinMetaBlockDiagnosticCode } from "./relevantWithinMetaBlockDiagnosticCodeEnum";
import { RelevantWithinMethodBlockDiagnosticCode } from "./relevantWithinMethodBlockDiagnosticCodeEnum";
import { NonBlockSpecificDiagnosticCode } from "./nonBlockSpecificDiagnosticCodeEnum";
import { RelevantWithinBodyBlockDiagnosticCode } from "./relevantWithinBodyBlockDiagnosticCodeEnum";
import { RelevantWithinAuthModeBlockDiagnosticCode } from "./relevantWithinAuthModeBlockDiagnosticCodeEnum";

export type KnownDiagnosticCode =
    | RelevantWithinAuthBlockDiagnosticCode
    | RelevantWithinMetaBlockDiagnosticCode
    | RelevantWithinMethodBlockDiagnosticCode
    | RelevantWithinBodyBlockDiagnosticCode
    | NonBlockSpecificDiagnosticCode
    | RelevantWithinAuthModeBlockDiagnosticCode;
