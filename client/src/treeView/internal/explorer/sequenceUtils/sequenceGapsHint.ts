import { env, ExtensionContext, MessageItem, Uri, window } from "vscode";
import {
    DialogOptionLabelEnum,
    getLoggerFromSubscriptions,
    getSequenceStepFromSettings,
    shouldRenumberSequencesAutomatically,
} from "@shared";

const minShiftedItemsForHint = 3;
const wasShownStateKey = "bru-as-code.wasSequenceGapsHintShown";
const readmeLink =
    "https://github.com/daniel-b92/bruno-vs-code-extension#review-friendly-diffs";

let extensionContext: ExtensionContext | undefined;
/** Prevents showing the hint again before the global state has been updated (e.g. while it is still open). */
let wasShownInThisSession = false;

/** Has to be called on activation, since the global state of the context stores whether the hint was already shown. */
export function initializeSequenceGapsHint(context: ExtensionContext) {
    extensionContext = context;
    wasShownInThisSession = false;
}

/**
 * Explains how gaps between sequences avoid changing other items, if an insert or move shifted several of them.
 * The hint is only shown once ever, and only with settings that do not already create or remove such gaps.
 * Does not wait for the user to react to the hint.
 */
export function showSequenceGapsHintIfNeeded(shiftedItemsCount: number) {
    const context = extensionContext;

    if (
        !context ||
        wasShownInThisSession ||
        shiftedItemsCount < minShiftedItemsForHint ||
        context.globalState.get<boolean>(wasShownStateKey) ||
        getSequenceStepFromSettings() != 1 ||
        shouldRenumberSequencesAutomatically()
    ) {
        return;
    }

    wasShownInThisSession = true;
    void showHint(context, shiftedItemsCount);
}

async function showHint(context: ExtensionContext, shiftedItemsCount: number) {
    try {
        // Stored before showing the message, so that it is not shown again, no matter how the user reacts to it.
        await context.globalState.update(wasShownStateKey, true);

        const pickedOption = await window.showInformationMessage<MessageItem>(
            `Inserting this item also changed the sequence of ${shiftedItemsCount} other items. With gaps between sequences, most inserts only change one file.`,
            { title: DialogOptionLabelEnum.LearnMore },
        );

        if (pickedOption?.title == DialogOptionLabelEnum.LearnMore) {
            await env.openExternal(Uri.parse(readmeLink));
        }
    } catch (err) {
        getLoggerFromSubscriptions(context)?.warn(
            `Could not handle the hint about sequence gaps: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
}
