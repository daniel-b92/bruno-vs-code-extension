import { TestRunProfile } from "vscode";

export interface RunProfileWithTag {
    runProfile: TestRunProfile;
    tag: string;
}

export class TestRunProfileWithTagRegistry {
    constructor() {
        this.profiles = [] as RunProfileWithTag[];
    }

    private profiles: { runProfile: TestRunProfile; tag: string }[];

    public registerProfile(profile: RunProfileWithTag) {
        const { tag } = profile;
        const existingProfilesWithTag = this.profiles.filter(
            ({ tag: t }) => t === tag,
        );

        if (existingProfilesWithTag.length > 0) {
            throw new Error(
                `Cannot register new profile with tag '${tag}'. Found ${existingProfilesWithTag} already registered profiles with the same tag.`,
            );
        }

        this.profiles.push(profile);
    }

    public unregisterProfileByTag(tag: string) {
        const matchingProfiles = this.profiles
            .map((val, index) => ({ ...val, index }))
            .filter(({ tag: t }) => t === tag);

        if (matchingProfiles.length > 1) {
            throw new Error(
                `Cannot unregister profile by tag. Found multiple test run profiles (${matchingProfiles.length}) with the tag '${tag}'`,
            );
        }

        if (matchingProfiles.length == 1) {
            const { runProfile } = this.profiles.splice(
                matchingProfiles[0].index,
                1,
            )[0];

            runProfile.dispose();
        }
    }

    public dispose() {
        if (this.profiles.length == 0) {
            return;
        }

        const toDispose = this.profiles.splice(0);
        for (const { runProfile } of toDispose) {
            runProfile.dispose();
        }
    }
}
