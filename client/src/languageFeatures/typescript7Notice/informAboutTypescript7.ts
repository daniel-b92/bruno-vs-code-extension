import {
    ConfigurationTarget,
    env,
    ExtensionContext,
    extensions,
    MessageItem,
    Uri,
    window,
    workspace,
} from "vscode";
import {
    DialogOptionLabelEnum,
    getLoggerFromSubscriptions,
    OutputChannelLogger,
    TypedCollectionItemProvider,
} from "@shared";
import {
    isTypescript7ServerEnabled,
    typescript7SettingKeys,
} from "./isTypescript7ServerEnabled";

/**
 * Tells the user that the Javascript intellisense is unavailable, if the Typescript 7 server is used.
 * The message is shown at most once per session (unless dismissed permanently) and only if collections exist. The check is repeated when collections are added or when the settings or installed extensions change.
 * The message is always written to the output channel.
 */
export function informAboutTypescript7(
    context: ExtensionContext,
    collectionItemProvider: TypedCollectionItemProvider,
) {
    const logger = getLoggerFromSubscriptions(context);
    let wasHandledInThisSession = false;

    const check = () => {
        // The collection cache is loaded lazily, so collections might not be known yet. In that case, the check is repeated after the initial load.
        if (
            wasHandledInThisSession ||
            collectionItemProvider.getRegisteredCollections().length == 0 ||
            !isTypescript7ServerEnabled()
        ) {
            return;
        }
        wasHandledInThisSession = true;

        logger?.info(getMessage());

        if (
            workspace
                .getConfiguration()
                .get<boolean>(getSettingsKeyForShowingNotice(), true)
        ) {
            void showNotice(logger);
        }
    };

    const recheckAfterEnvironmentChange = () => {
        // A switch back to the default server ends the session of the notice, so that a later switch is reported again.
        wasHandledInThisSession &&= isTypescript7ServerEnabled();
        check();
    };

    collectionItemProvider.subscribeToInitialCacheLoad(check);
    // Collections might be added later during the session.
    collectionItemProvider.subscribeToUpdates(check);
    context.subscriptions.push(
        workspace.onDidChangeConfiguration((event) => {
            if (
                typescript7SettingKeys.some((key) =>
                    event.affectsConfiguration(key),
                )
            ) {
                recheckAfterEnvironmentChange();
            }
        }),
        // The Typescript 7 server is only used if one of the Typescript 7 extensions is installed.
        extensions.onDidChange(recheckAfterEnvironmentChange),
    );
}

async function showNotice(logger: OutputChannelLogger | undefined) {
    try {
        await showNoticeAndHandlePickedOption();
    } catch (err) {
        logger?.warn(
            `Could not handle the notice about Typescript 7: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
}

async function showNoticeAndHandlePickedOption() {
    const learnMoreOption = DialogOptionLabelEnum.LearnMore;
    const doNotShowAgainOption = DialogOptionLabelEnum.DoNotAskAgain;

    const pickedOption = await window.showInformationMessage<MessageItem>(
        getMessage(),
        { title: learnMoreOption },
        { title: doNotShowAgainOption },
    );

    if (pickedOption?.title == learnMoreOption) {
        await env.openExternal(Uri.parse(getReadmeLink()));
    } else if (pickedOption?.title == doNotShowAgainOption) {
        await workspace
            .getConfiguration()
            .update(
                getSettingsKeyForShowingNotice(),
                false,
                ConfigurationTarget.Global,
            );
    }
}

function getMessage() {
    return "Javascript intellisense in Bruno files (scripts and tests) is not available with the Typescript 7 language server yet. Use the default language server to get it.";
}

function getReadmeLink() {
    return "https://github.com/daniel-b92/bruno-vs-code-extension#typescript-7-language-server";
}

function getSettingsKeyForShowingNotice() {
    return "bru-as-code.informAboutTypescript7";
}
