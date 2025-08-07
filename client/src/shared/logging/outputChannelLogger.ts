import { LogOutputChannel } from "vscode";

export class OutputChannelLogger {
    constructor(private vsCodeLogger: LogOutputChannel) {}

    public info(message: string) {
        this.vsCodeLogger.info(message);
    }

    public debug(message: string) {
        this.vsCodeLogger.debug(message);
    }

    public trace(message: string) {
        this.vsCodeLogger.trace(message);
    }

    public warn(message: string) {
        console.warn(message);
        this.vsCodeLogger.warn(message);
    }

    public error(message: string, ...args: (Error | undefined)[]) {
        console.error(message, args);
        this.vsCodeLogger.error(message, args);
    }

    public dispose() {
        this.vsCodeLogger.dispose();
    }
}
