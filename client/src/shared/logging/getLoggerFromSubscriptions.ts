import { ExtensionContext } from "vscode";
import { OutputChannelLogger } from "./outputChannelLogger";

export function getLoggerFromSubscriptions(context: ExtensionContext) {
    return context.subscriptions.find(
        (disposable) => disposable instanceof OutputChannelLogger
    );
}
