export default class HuffmanCodebook {
    Codes: number[]
    Bits: number[]
    ValueCount: number
    ValueCountPower: number
    ValueBits: number
    ValueMax: number
    MaxBitSize: number
    Lookup: number[]
    constructor(codes: number[], bits: number[], valueCountPower: number) {
        this.Codes = codes;
        this.Bits = bits;

        if (this.Codes === null || this.Bits === null) {
            throw new Error("Codes or Bits is null");
        }

        this.ValueCount = 1 << valueCountPower;
        this.ValueCountPower = valueCountPower;
        this.ValueBits = Math.log2(this.Codes.length) >> valueCountPower;
        this.ValueMax = 1 << this.ValueBits;

        let max = 0;
        for (const bitSize of this.Bits) {
            max = Math.max(max, bitSize);
        }

        this.MaxBitSize = max;
        this.Lookup = this.createLookupTable();
    }

    createLookupTable() {
        const tableSize = 1 << this.MaxBitSize;
        const dest: number[] = new Array(tableSize).fill(0);

        for (let i = 0; i < this.Bits.length; i++) {
            if (this.Bits[i] === 0) continue;
            const unusedBits = this.MaxBitSize - this.Bits[i];

            const start = this.Codes[i] << unusedBits;
            const length = 1 << unusedBits;
            const end = start + length;

            for (let j = start; j < end; j++) {
                dest[j] = i;
            }
        }
        return dest;
    }
}