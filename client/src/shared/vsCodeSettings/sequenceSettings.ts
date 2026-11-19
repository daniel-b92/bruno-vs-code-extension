import { workspace } from "vscode";

const sequenceStepSettingKey = "bru-as-code.sequenceStep";
const renumberSequencesSettingKey =
    "bru-as-code.renumberSequencesAutomatically";
const defaultSequenceStep = 1;

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
