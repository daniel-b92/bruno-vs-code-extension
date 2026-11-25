import { workspace } from "vscode";
import { parseSequenceStep } from "@global_shared";

const sequenceStepSettingKey = "bru-as-code.sequenceStep";
const renumberSequencesSettingKey =
    "bru-as-code.renumberSequencesAutomatically";
const prefixNamesWithSequenceSettingKey = "bru-as-code.prefixNamesWithSequence";

/** The step between the sequences of consecutive items, that is used when new items are appended or sequences are renumbered. */
export function getSequenceStepFromSettings() {
    return parseSequenceStep(
        workspace.getConfiguration().get<unknown>(sequenceStepSettingKey),
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

/** If enabled, the names of items with a sequence start with that sequence (e.g. `010_get-token.bru`). */
export function shouldPrefixNamesWithSequence() {
    return (
        workspace
            .getConfiguration()
            .get<unknown>(prefixNamesWithSequenceSettingKey) === true
    );
}
