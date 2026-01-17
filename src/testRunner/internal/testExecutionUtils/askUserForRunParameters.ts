import { Disposable, EventEmitter, QuickPickItem, window } from "vscode";
import { Collection, getDistinctTagsForCollection } from "../../../shared";
import { OtherExecutionConfigData, UserInputData } from "../interfaces";

enum NonTagRelatedButtonLabel {
    Run = "Run",
    OtherConfigs = "Other configs",
}

enum TagRelatedButtonLabel {
    IncludeTags = "Include tags",
    ExcludeTags = "Exclude tags",
}

export async function askUserForTestrunParameters(collection: Collection) {
    const selectionHolder = new SelectionHolder();
    const handleBaseModalNotifier = new EventEmitter<void>();
    const handleTagsDialogNotifier = new EventEmitter<
        TagRelatedButtonLabel.IncludeTags | TagRelatedButtonLabel.ExcludeTags
    >();
    const handleOtherConfigsDialogNotifier = new EventEmitter<void>();
    const toDispose: Disposable[] = [];

    const userInputPromise = new Promise<UserInputData | undefined>(
        (resolve) => {
            toDispose.push(
                handleBaseModalNotifier.event(() => {
                    handleBaseModalInteractions(
                        selectionHolder,
                        handleOtherConfigsDialogNotifier,
                        getDistinctTagsForCollection(collection).length > 0 // Only allow editing of included/excluded tags, if there are some tags defined in the collection.
                            ? handleTagsDialogNotifier
                            : undefined,
                    ).then(({ shouldContinue, value }) => {
                        if (!shouldContinue) {
                            resolve(value);
                        }
                    });
                }),
                handleTagsDialogNotifier.event((selectedButton) => {
                    handleDialogForTags(
                        selectedButton,
                        collection,
                        selectionHolder,
                        handleBaseModalNotifier,
                    );
                }),
                handleOtherConfigsDialogNotifier.event(() => {
                    handleDialogForOtherConfigs(
                        selectionHolder,
                        handleBaseModalNotifier,
                    );
                }),
            );
        },
    );
    handleBaseModalNotifier.fire();

    const userInput = await userInputPromise;
    toDispose.forEach((d) => d.dispose());
    return userInput;
}

async function handleBaseModalInteractions(
    selectionHolder: SelectionHolder,
    handleOtherConfigsDialogNotifier: EventEmitter<void>,
    tagsDialogNotifier?: EventEmitter<
        TagRelatedButtonLabel.IncludeTags | TagRelatedButtonLabel.ExcludeTags
    >,
): Promise<{
    shouldContinue: boolean;
    value?: UserInputData;
}> {
    const { includedTags, excludedTags } = selectionHolder.getSelectedOptions();

    const pickedOption = await window.showInformationMessage(
        `Do you want to add additional config options?`,
        {
            modal: true,
            detail: tagsDialogNotifier
                ? `Currently ${includedTags.length} included tags, ${excludedTags.length} excluded tags`
                : undefined,
        },
        ...(
            Object.values(NonTagRelatedButtonLabel) as (
                | NonTagRelatedButtonLabel
                | TagRelatedButtonLabel
            )[]
        ).concat(
            tagsDialogNotifier ? Object.values(TagRelatedButtonLabel) : [],
        ),
    );

    if (pickedOption == undefined) {
        return { shouldContinue: false };
    }

    switch (pickedOption) {
        case NonTagRelatedButtonLabel.Run:
            return {
                shouldContinue: false,
                value: selectionHolder.getSelectedOptions(),
            };

        case NonTagRelatedButtonLabel.OtherConfigs:
            handleOtherConfigsDialogNotifier.fire();
            break;

        default:
            if (tagsDialogNotifier) {
                tagsDialogNotifier.fire(pickedOption);
            }
    }

    return { shouldContinue: true };
}

async function handleDialogForTags(
    selectedButton:
        | TagRelatedButtonLabel.IncludeTags
        | TagRelatedButtonLabel.ExcludeTags,
    collection: Collection,
    selectionHolder: SelectionHolder,
    baseModalNotifier: EventEmitter<void>,
) {
    const { includedTags: includedTags, excludedTags: excludedTags } =
        selectionHolder.getSelectedOptions();

    const items: QuickPickItem[] = getDistinctTagsForCollection(collection)
        .filter((tag) =>
            selectedButton == TagRelatedButtonLabel.IncludeTags
                ? !excludedTags.includes(tag)
                : !includedTags.includes(tag),
        )
        .sort((tag1, tag2) => (tag1 < tag2 ? -1 : 1))
        .map((tag) => ({
            label: tag,
            picked:
                selectedButton == TagRelatedButtonLabel.IncludeTags
                    ? includedTags.includes(tag)
                    : excludedTags.includes(tag),
        }));

    const selectedItems = await window.showQuickPick(items, {
        canPickMany: true,
        ignoreFocusOut: true,
        title: `Tags to ${selectedButton == TagRelatedButtonLabel.IncludeTags ? "include" : "exclude"}`,
    });

    if (!selectedItems) {
        return;
    }

    const selectedTags = selectedItems.map(({ label }) => label);

    switch (selectedButton) {
        case TagRelatedButtonLabel.IncludeTags:
            selectionHolder.setIncludedTags(selectedTags);
            break;
        case TagRelatedButtonLabel.ExcludeTags:
            selectionHolder.setExcludedTags(selectedTags);
            break;
    }

    baseModalNotifier.fire();
}

async function handleDialogForOtherConfigs(
    selectionHolder: SelectionHolder,
    baseModalNotifier: EventEmitter<void>,
) {
    const { otherConfigs: initialSelection } =
        selectionHolder.getSelectedOptions();
    const getValueForSelectionHolder = (
        key: keyof OtherExecutionConfigData,
        selectedItems: QuickPickItem[],
    ) =>
        selectedItems.some(
            ({ label }) => (label as keyof OtherExecutionConfigData) == key,
        );

    const items: QuickPickItem[] = Object.keys(initialSelection)
        .sort((key1, key2) => (key1 < key2 ? -1 : 1))
        .map((label) => {
            const key = label as keyof OtherExecutionConfigData;

            return {
                label: label,
                picked: initialSelection[key],
                description:
                    key == "bail"
                        ? "Abort execution on the first failed request, test or assertion."
                        : key == "parallel"
                          ? "Run requests in parallel."
                          : undefined,
            };
        });

    const newSelection = await window.showQuickPick(items, {
        canPickMany: true,
        ignoreFocusOut: true,
        title: "Additional configs for testrun",
    });

    if (!newSelection) {
        return;
    }

    selectionHolder.setOtherConfigs({
        recursive: getValueForSelectionHolder("recursive", newSelection),
        bail: getValueForSelectionHolder("bail", newSelection),
        parallel: getValueForSelectionHolder("parallel", newSelection),
    });

    baseModalNotifier.fire();
}

class SelectionHolder {
    constructor() {}

    private includedTags: string[] = [];
    private excludedTags: string[] = [];
    private recursive = true;
    private bail = false;
    private parallel = false;

    public getSelectedOptions(): UserInputData {
        return {
            includedTags: this.includedTags.slice(),
            excludedTags: this.excludedTags.slice(),
            otherConfigs: {
                recursive: this.recursive,
                bail: this.bail,
                parallel: this.parallel,
            },
        };
    }

    public setIncludedTags(newTags: string[]) {
        if (this.includedTags.length > 0) {
            this.includedTags.splice(0);
        }
        this.includedTags.push(...newTags);
    }

    public setExcludedTags(newTags: string[]) {
        if (this.excludedTags.length > 0) {
            this.excludedTags.splice(0);
        }
        this.excludedTags.push(...newTags);
    }

    public setOtherConfigs({
        bail,
        parallel,
        recursive,
    }: OtherExecutionConfigData) {
        this.bail = bail;
        this.parallel = parallel;
        this.recursive = recursive;
    }
}
