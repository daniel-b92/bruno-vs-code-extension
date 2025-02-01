import { getSequence } from "../fileSystem/testFileParser";

export class TestFile {
    constructor(public path: string, private sequence: number) {}

    public getSequence() {
        return this.sequence;
    }

    /**
     * Updates the sequence for an existing test file.
     */
    public updateSequenceFromDisk() {
        const sequence = getSequence(this.path);

        if (sequence) {
            this.sequence = sequence;
        }

        return this;
    }
}
