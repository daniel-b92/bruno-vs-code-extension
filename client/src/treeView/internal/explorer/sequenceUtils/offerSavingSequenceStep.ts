import { ConfigurationTarget, MessageItem, window, workspace } from "vscode";
import { Logger } from "@global_shared";
import {
    DialogOptionLabelEnum,
    getSequenceStepFromSettings,
    saveSequenceStepToWorkspaceSettings,
} from "@shared";

const offerSettingKey = "bru-as-code.offerSavingSequenceStep";
const saveOption = "Save in workspace settings";

/**
 * Offers to save the step, with which sequences have been normalized, if it differs from the configured one.
 * Otherwise, items that are added later would not follow that step.
 */
export async function offerSavingSequenceStep(
    sequenceStep: number,
    logger?: Logger,
) {
    if (
        sequenceStep == getSequenceStepFromSettings() ||
        workspace.getConfiguration().get<unknown>(offerSettingKey) === false
    ) {
        return;
    }

    try {
        const pickedOption = await window.showInformationMessage<MessageItem>(
            `Use ${sequenceStep} as the sequence step in this workspace?`,
            { title: saveOption },
            { title: DialogOptionLabelEnum.DoNotAskAgain },
        );

        if (pickedOption?.title == saveOption) {
            await saveSequenceStepToWorkspaceSettings(sequenceStep);
        } else if (pickedOption?.title == DialogOptionLabelEnum.DoNotAskAgain) {
            await workspace
                .getConfiguration()
                .update(offerSettingKey, false, ConfigurationTarget.Global);
        }
    } catch (err) {
        logger?.warn(
            `Could not handle the offer to save the sequence step: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
}
