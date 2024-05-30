import AudioFormatBase from "./AudioFormatBase";

export default class AudioReader {
    TConfig: any;
    constructor() {
        this.TConfig = null
        if (this.constructor === AudioReader) {
            throw new Error('Cannot instantiate abstract class AudioReader.');
        }
    }

    readFormat(stream: ArrayBuffer) {
        return this.readStream(stream).audioFormat;
    }

    readFormatFromArray(file: ArrayBuffer) {
        return this.readByteArray(file).audioFormat;
    }

    read(stream: ArrayBuffer) {
        return this.readStream(stream).audio;
    }

    readFromArray(file: ArrayBuffer) {
        return this.readByteArray(file).audio;
    }

    readWithConfig(stream: ArrayBuffer) {
        return this.readStream(stream);
    }

    readWithConfigFromArray(file: ArrayLike<number> | ArrayBufferLike) {
        return this.readByteArray(file);
    }

    readMetadata(stream: ArrayBuffer) {
        const structure = this.readFile(stream, false);
        return this.getConfiguration(structure);
    }

    getConfiguration(structure: any) {
        return new this.TConfig();
    }

    readFile(stream: ArrayBuffer, readAudioData = true) {
        throw new Error('Method "readFile" must be implemented in derived classes.');
    }

    toAudioStream(structure: any): AudioFormatBase {
        throw new Error('Method "toAudioStream" must be implemented in derived classes.');
    }

    readByteArray(file: ArrayLike<number> | ArrayBufferLike) {
        const stream = new Uint8Array(file).buffer;
        return this.readStream(stream);
    }

    readStream(stream: ArrayBuffer) {
        const structure = this.readFile(stream);
        const audioStream = this.toAudioStream(structure);
        const configuration = this.getConfiguration(structure);
        return { audio: audioStream, audioFormat: audioStream };
    }
}