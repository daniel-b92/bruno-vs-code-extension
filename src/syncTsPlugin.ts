import { extensions } from "vscode";

export const syncTsPlugin = async () => {
    const ext = extensions.getExtension("vscode.typescript-language-features");
    if (ext) {
        if (!ext.isActive) {
            await ext.activate();
        }
        const tsAPi = ext.exports.getAPI(0);
        tsAPi.configurePlugin("@zentryc5t/ts-plugin-for-bruno", {
            name: "@zentryc5t/ts-plugin-for-bruno",
            languages: ["bruno"]
        });
    }
};
