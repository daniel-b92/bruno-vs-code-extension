import { extensions } from "vscode";

export const syncTsPlugin = async () => {
    const ext = extensions.getExtension("vscode.typescript-language-features");
    if (ext) {
        if (!ext.isActive) {
            await ext.activate();
        }
        const tsAPi = ext.exports.getAPI(0);
        tsAPi.configurePlugin("@daniel-b92/ts-plugin-for-bruno", {
            name: "@daniel-b92/ts-plugin-for-bruno",
            languages: ["bruno"]
        });
    }
};
