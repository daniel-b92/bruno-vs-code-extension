export interface PluginConfig {
    yamlCollectionSupport: boolean;
}

/**
 * The configuration is passed to the plugin by the VS Code extension (see `configureTsServerPlugin` in the client).
 * As long as no configuration is passed, Yaml collections are not supported.
 */
export class PluginConfiguration {
    private config: PluginConfig = { yamlCollectionSupport: false };
    private readonly changeListeners: (() => void)[] = [];

    isYamlCollectionSupportEnabled() {
        return this.config.yamlCollectionSupport;
    }

    onDidChange(listener: () => void) {
        this.changeListeners.push(listener);
    }

    update(config: Partial<PluginConfig> | undefined) {
        const yamlCollectionSupport = config?.yamlCollectionSupport == true;

        if (yamlCollectionSupport == this.config.yamlCollectionSupport) {
            return;
        }

        this.config = { yamlCollectionSupport };

        for (const listener of this.changeListeners) {
            listener();
        }
    }
}
