export default class BinaryReader {
    dataView: DataView
    position: number
    length: number
    constructor(arrayBuffer: ArrayBuffer) {
        this.dataView = new DataView(arrayBuffer);
        this.position = 0;
        this.length = arrayBuffer.byteLength;
    }

    readUTF8(length: number) {
        const bytes = new Uint8Array(this.dataView.buffer, this.position, length);
        this.position += length;
        return new TextDecoder('utf-8').decode(bytes);
    }

    readUInt8() {
        const value = this.dataView.getUint8(this.position);
        this.position += 1;
        return value;
    }

    readUInt16() {
        const value = this.dataView.getUint16(this.position, true);
        this.position += 2;
        return value;
    }

    readInt16() {
        const value = this.dataView.getInt16(this.position, true);
        this.position += 2;
        return value;
    }

    readUInt32() {
        const value = this.dataView.getUint32(this.position, true); // true for little-endian
        this.position += 4;
        return value;
    }

    readInt32() {
        const value = this.dataView.getInt32(this.position, true); // true for little-endian
        this.position += 4;
        return value;
    }

    readBytes(length: number) {
        const bytes = new Uint8Array(this.dataView.buffer, this.position, length);
        this.position += length;
        return bytes;
    }

    deInterleave(length: number, interleaveSize: number, outputCount: number, outputSize = -1) {
        if (length % outputCount !== 0) {
            throw new Error(`The input length (${length}) must be divisible by the number of outputs.`);
        }
    
        const inputSize = length / outputCount;
        if (outputSize === -1) {
            outputSize = inputSize;
        }
    
        const inBlockCount = Math.ceil(inputSize / interleaveSize);
        const outBlockCount = Math.ceil(outputSize / interleaveSize);
        const lastInputInterleaveSize = inputSize - (inBlockCount - 1) * interleaveSize;
        const lastOutputInterleaveSize = outputSize - (outBlockCount - 1) * interleaveSize;
        const blocksToCopy = Math.min(inBlockCount, outBlockCount);
    
        const outputs = Array.from({ length: outputCount }, () => new Uint8Array(outputSize));
    
        for (let b = 0; b < blocksToCopy; b++) {
            const currentInputInterleaveSize = b === inBlockCount - 1 ? lastInputInterleaveSize : interleaveSize;
            const currentOutputInterleaveSize = b === outBlockCount - 1 ? lastOutputInterleaveSize : interleaveSize;
            const bytesToCopy = Math.min(currentInputInterleaveSize, currentOutputInterleaveSize);
    
            for (let o = 0; o < outputCount; o++) {
                const chunk = this.readBytes(bytesToCopy);
                outputs[o].set(chunk, interleaveSize * b);
                if (bytesToCopy < currentInputInterleaveSize) {
                    // Skip the remaining bytes in the input interleave block
                    this.position += currentInputInterleaveSize - bytesToCopy;
                }
            }
        }
    
        return outputs;
    }
    
}