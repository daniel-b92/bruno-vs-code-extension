import { ConfigurationTarget, workspace } from "vscode";

const sequenceStepSettingKey = "bru-as-code.sequenceStep";
const renumberSequencesSettingKey =
    "bru-as-code.renumberSequencesAutomatically";
const defaultSequenceStep = 1;
const prefixNamesWithSequenceSettingKey = "bru-as-code.prefixNamesWithSequence";

/** The step between the sequences of consecutive items, that is used when new items are appended or sequences are renumbered. */
export function getSequenceStepFromSettings() {
    const configured = workspace
        .getConfiguration()
        .get<unknown>(sequenceStepSettingKey);

    return typeof configured == "number" &&
        Number.isInteger(configured) &&
        configured > 0
        ? configured
        : defaultSequenceStep;
}

/** Saves the step in the workspace settings, so that it can be shared with others who work on the same files. */
export async function saveSequenceStepToWorkspaceSettings(
    sequenceStep: number,
) {
    await workspace
        .getConfiguration()
        .update(
            sequenceStepSettingKey,
            sequenceStep,
            ConfigurationTarget.Workspace,
        );
}

/**
 * If enabled, the sequences of all affected folders are renumbered after every insert, move and delete in the collection explorer.
 * Otherwise, the sequences of other items are kept whenever possible.
 */
export function shouldRenumberSequencesAutomatically() {
    return (
        workspace
            .getConfiguration()
            .get<unknown>(renumberSequencesSettingKey) === true
    );
}

/** If enabled, the names of items with a sequence start with that sequence (e.g. `00010_get-token.bru`). */
export function shouldPrefixNamesWithSequence() {
    return (
        workspace
            .getConfiguration()
            .get<unknown>(prefixNamesWithSequenceSettingKey) === true
    );
}
