export default class Watcher {
    constructor(_path: string, _options?: unknown) {}
    on(_event: string, _handler: unknown) {
        return this;
    }
    close() {}
}
