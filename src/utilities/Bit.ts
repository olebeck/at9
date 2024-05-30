export default class Bit {
    static bitReverse32(value: number) {
        value = ((value & 0xaaaaaaaa) >>> 1) | ((value & 0x55555555) << 1);
        value = ((value & 0xcccccccc) >>> 2) | ((value & 0x33333333) << 2);
        value = ((value & 0xf0f0f0f0) >>> 4) | ((value & 0x0f0f0f0f) << 4);
        value = ((value & 0xff00ff00) >>> 8) | ((value & 0x00ff00ff) << 8);
        return (value >>> 16) | (value << 16) >>> 0; // Ensure the result is an unsigned 32-bit integer
    }

    static bitReverse32WithBitCount(value: number, bitCount: number) {
        return Bit.bitReverse32(value) >>> (32 - bitCount);
    }

    static bitReverse8(value: number) {
        return ((value * 0x80200802) & 0x0884422110) * 0x0101010101 >> 32;
    }

    static signExtend32(value: number, bits: number) {
        const shift = 8 * 4 - bits; // Assuming 32-bit integers
        return (value << shift) >> shift;
    }
}