import { RemoteConsole } from "vscode-languageserver";

export class ConsoleLogger {
    constructor(private console: RemoteConsole) {}

    public info(message: string) {
        this.console.info(message);
    }

    public debug(message: string) {
        this.console.debug(message);
    }

    public warn(message: string) {
        console.warn(message);
        this.console.warn(message);
    }

    public error(message: string) {
        console.error(message);
        this.console.error(message);
    }
}
