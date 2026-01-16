import { Disposable, EventEmitter, QuickPickItem, window } from "vscode";
import { Collection, getDistinctTagsForCollection } from "../../../shared";
import { OtherConfigData, UserInputData } from "../interfaces";

enum ButtonLabel {
    Run = "Run",
    IncludeTags = "Include tags",
    ExcludeTags = "Exclude tags",
    OtherConfigs = "Other configs",
}

export async function askUserForTestrunParameters(collection: Collection) {
    const selectedTagsProvider = new SelectedTagsProvider();
    const selectedOtherConfigsProvider = new SelectedOtherConfigsProvider();
    const handleBaseModalNotifier = new EventEmitter<void>();
    const handleTagsDialogNotifier = new EventEmitter<
        ButtonLabel.IncludeTags | ButtonLabel.ExcludeTags
    >();
    const handleOtherConfigsDialogNotifier = new EventEmitter<void>();
    const toDispose: Disposable[] = [];

    const userInputPromise = new Promise<UserInputData | undefined>(
        (resolve) => {
            toDispose.push(
                handleBaseModalNotifier.event(() => {
                    handleBaseModalInteractions(
                        selectedTagsProvider,
                        selectedOtherConfigsProvider,
                        handleTagsDialogNotifier,
                        handleOtherConfigsDialogNotifier,
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
                        selectedTagsProvider,
                        handleBaseModalNotifier,
                    );
                }),
                handleOtherConfigsDialogNotifier.event(() => {
                    handleDialogForOtherConfigs(
                        selectedOtherConfigsProvider,
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
    selectedTagsProvider: SelectedTagsProvider,
    otherConfigsProvider: SelectedOtherConfigsProvider,
    tagsDialogNotifier: EventEmitter<
        ButtonLabel.IncludeTags | ButtonLabel.ExcludeTags
    >,
    handleOtherConfigsDialogNotifier: EventEmitter<void>,
): Promise<{
    shouldContinue: boolean;
    value?: UserInputData;
}> {
    const { included: includedTags, excluded: excludedTags } =
        selectedTagsProvider.getSelectedTags();

    const pickedOption = await window.showInformationMessage(
        `Do you want to add additional config options?`,
        {
            modal: true,
            detail: `Currently ${includedTags.length} included tags, ${excludedTags.length} excluded tags`,
        },
        ...Object.values(ButtonLabel),
    );

    if (pickedOption == undefined) {
        return { shouldContinue: false };
    }

    switch (pickedOption) {
        case ButtonLabel.Run:
            const { included: includedTags, excluded: excludedTags } =
                selectedTagsProvider.getSelectedTags();
            const selectedOtherConfigs = otherConfigsProvider.getValues();
            return {
                shouldContinue: false,
                value: {
                    includedTags,
                    excludedTags,
                    otherConfigs: selectedOtherConfigs,
                },
            };

        case ButtonLabel.OtherConfigs:
            handleOtherConfigsDialogNotifier.fire();
            break;

        default:
            tagsDialogNotifier.fire(pickedOption);
    }

    return { shouldContinue: true };
}

async function handleDialogForTags(
    selectedButton: ButtonLabel.IncludeTags | ButtonLabel.ExcludeTags,
    collection: Collection,
    selectedTagsProvider: SelectedTagsProvider,
    baseModalNotifier: EventEmitter<void>,
) {
    const { included: includedTags, excluded: excludedTags } =
        selectedTagsProvider.getSelectedTags();

    const items: QuickPickItem[] = getDistinctTagsForCollection(collection)
        .filter((tag) =>
            selectedButton == ButtonLabel.IncludeTags
                ? !excludedTags.includes(tag)
                : !includedTags.includes(tag),
        )
        .sort((tag1, tag2) => (tag1 < tag2 ? -1 : 1))
        .map((tag) => ({
            label: tag,
            picked:
                selectedButton == ButtonLabel.IncludeTags
                    ? includedTags.includes(tag)
                    : excludedTags.includes(tag),
        }));

    const selectedItems = await window.showQuickPick(items, {
        canPickMany: true,
        ignoreFocusOut: true,
        title: `Tags to ${selectedButton == ButtonLabel.IncludeTags ? "include" : "exclude"}`,
    });

    if (!selectedItems) {
        return;
    }

    const selectedTags = selectedItems.map(({ label }) => label);

    switch (selectedButton) {
        case ButtonLabel.IncludeTags:
            selectedTagsProvider.setIncludedTags(selectedTags);
            break;
        case ButtonLabel.ExcludeTags:
            selectedTagsProvider.setExcludedTags(selectedTags);
            break;
    }

    baseModalNotifier.fire();
}

async function handleDialogForOtherConfigs(
    configsProvider: SelectedOtherConfigsProvider,
    baseModalNotifier: EventEmitter<void>,
) {
    const initialSelection = configsProvider.getValues();
    const getValueForProvider = (
        key: keyof OtherConfigData,
        selectedItems: QuickPickItem[],
    ) =>
        selectedItems.some(
            ({ label }) => (label as keyof OtherConfigData) == key,
        );

    const items: QuickPickItem[] = Object.keys(initialSelection)
        .sort((key1, key2) => (key1 < key2 ? -1 : 1))
        .map((key) => ({
            label: key,
            picked: initialSelection[key as keyof OtherConfigData],
        }));

    const newSelection = await window.showQuickPick(items, {
        canPickMany: true,
        ignoreFocusOut: true,
        title: "Additional configs for testrun",
    });

    if (!newSelection) {
        return;
    }

    configsProvider.setValues({
        recursive: getValueForProvider("recursive", newSelection),
        sandboxModeDeveloper: getValueForProvider(
            "sandboxModeDeveloper",
            newSelection,
        ),
    });

    baseModalNotifier.fire();
}

class SelectedTagsProvider {
    constructor() {}

    private includedTags: string[] = [];
    private excludedTags: string[] = [];

    public getSelectedTags() {
        return {
            included: this.includedTags.slice(),
            excluded: this.excludedTags.slice(),
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
}

class SelectedOtherConfigsProvider {
    constructor() {
        this.values = this.defaultValues;
    }

    private readonly defaultValues: OtherConfigData = {
        recursive: true,
        sandboxModeDeveloper: false,
    };
    private values: OtherConfigData;

    public setValues(newVals: OtherConfigData) {
        this.values = newVals;
    }

    public getValues() {
        return this.values;
    }
}
