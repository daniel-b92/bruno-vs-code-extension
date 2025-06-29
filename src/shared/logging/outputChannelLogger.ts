import { LogOutputChannel } from "vscode";

export class OutputChannelLogger {
    constructor(private vsCodeLogger: LogOutputChannel) {}

    public info(message: string) {
        this.vsCodeLogger.info(message);
    }

    public debug(message: string) {
        this.vsCodeLogger.debug(message);
    }

    public dispose() {
        this.vsCodeLogger.dispose();
    }
}
