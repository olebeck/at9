import Bit from "./Bit.js";

export default class BitReader {
    static OffsetBias = {
        Positive: 1,
        Negative: 0,
    }

    buffer: Uint8Array|null
    lengthBits: number
    position: number
    constructor(buffer: Uint8Array|null) {
        this.buffer = null;
        this.lengthBits = 0;
        this.position = 0;
        this.setBuffer(buffer);
    }

    setBuffer(buffer: Uint8Array|null) {
        this.buffer = buffer;
        this.lengthBits = this.buffer ? this.buffer.length * 8 : 0;
        this.position = 0;
    }

    get remaining() {
        return this.lengthBits - this.position;
    }

    readInt(bitCount: number) {
        const value = this.peekInt(bitCount);
        this.position += bitCount;
        return value;
    }

    readSignedInt(bitCount: number) {
        const value = this.peekInt(bitCount);
        this.position += bitCount;
        return Bit.signExtend32(value, bitCount);
    }

    readBool() {
        return this.readInt(1) === 1;
    }

    readOffsetBinary(bitCount: number, bias: number) {
        const offset = (1 << (bitCount - 1)) - bias;
        const value = this.peekInt(bitCount) - offset;
        this.position += bitCount;
        return value;
    }

    alignPosition(multiple: number) {
        this.position = Math.ceil(this.position / multiple) * multiple;
    }

    peekInt(bitCount: number) {
        if(!this.buffer) return 0;

        if (bitCount > this.remaining) {
            if (this.position >= this.lengthBits) return 0;

            const extraBits = bitCount - this.remaining;
            return this.peekIntFallback(this.remaining) << extraBits;
        }

        const byteIndex = Math.floor(this.position / 8);
        const bitIndex = this.position % 8;

        if (bitCount <= 9 && this.remaining >= 16) {
            let value = (this.buffer[byteIndex] << 8) | this.buffer[byteIndex + 1];
            value &= 0xFFFF >> bitIndex;
            value >>= 16 - bitCount - bitIndex;
            return value;
        }

        if (bitCount <= 17 && this.remaining >= 24) {
            let value = (this.buffer[byteIndex] << 16) | (this.buffer[byteIndex + 1] << 8) | this.buffer[byteIndex + 2];
            value &= 0xFFFFFF >> bitIndex;
            value >>= 24 - bitCount - bitIndex;
            return value;
        }

        if (bitCount <= 25 && this.remaining >= 32) {
            let value = (this.buffer[byteIndex] << 24) | (this.buffer[byteIndex + 1] << 16) | (this.buffer[byteIndex + 2] << 8) | this.buffer[byteIndex + 3];
            value &= (0xFFFFFFFF >> bitIndex);
            value >>= 32 - bitCount - bitIndex;
            return value;
        }

        return this.peekIntFallback(bitCount);
    }

    peekIntFallback(bitCount: number) {
        if(!this.buffer) return 0;
        let value = 0;
        let byteIndex = Math.floor(this.position / 8);
        let bitIndex = this.position % 8;

        while (bitCount > 0) {
            if (bitIndex >= 8) {
                bitIndex = 0;
                byteIndex++;
            }

            const bitsToRead = Math.min(bitCount, 8 - bitIndex);
            const mask = 0xFF >> bitIndex;
            const currentByte = (mask & this.buffer[byteIndex]) >> (8 - bitIndex - bitsToRead);

            value = (value << bitsToRead) | currentByte;
            bitIndex += bitsToRead;
            bitCount -= bitsToRead;
        }
        return value;
    }
}