import Bit from "./Bit.js"

export default class Mdct {
    static _tableBits = -1
    static SinTables: Float64Array[] = []
    static CosTables: Float64Array[] = []
    static ShuffleTables: Int32Array[] = []

    MdctBits: number
    MdctSize: number
    Scale: number

    _mdctPrevious: Float64Array
    _imdctPrevious: Float64Array
    _scratchMdct: Float64Array
    _scratchDct: Float64Array
    _imdctWindow: Float64Array

    constructor(mdctBits: number, window: Float64Array, scale = 1) {
        this.SetTables(mdctBits);

        this.MdctBits = mdctBits;
        this.MdctSize = 1 << mdctBits;
        this.Scale = scale;

        if (window.length < this.MdctSize) {
            throw new Error("Window must be as long as the MDCT size.");
        }

        this._mdctPrevious = new Float64Array(this.MdctSize).fill(0);
        this._imdctPrevious = new Float64Array(this.MdctSize).fill(0);
        this._scratchMdct = new Float64Array(this.MdctSize).fill(0);
        this._scratchDct = new Float64Array(this.MdctSize).fill(0);
        this._imdctWindow = window;
    }

    SetTables(maxBits: number) {
        if (maxBits > Mdct._tableBits) {
            for (let i = Mdct._tableBits + 1; i <= maxBits; i++) {
                const [sin, cos] = Mdct.GenerateTrigTables(i);
                Mdct.SinTables.push(sin);
                Mdct.CosTables.push(cos);
                Mdct.ShuffleTables.push(this.GenerateShuffleTable(i));
            }
            Mdct._tableBits = maxBits;
        }
    }

    RunMdct(input: number[], output: Float64Array) {
        if (input.length < this.MdctSize || output.length < this.MdctSize) {
            throw new Error("Input and output must be as long as the MDCT size.");
        }

        const size = this.MdctSize;
        const half = size / 2;
        const dctIn = this._scratchMdct;

        for (let i = 0; i < half; i++) {
            const a = this._imdctWindow[half - i - 1] * -input[half + i];
            const b = this._imdctWindow[half + i] * input[half - i - 1];
            const c = this._imdctWindow[i] * this._mdctPrevious[i];
            const d = this._imdctWindow[size - i - 1] * this._mdctPrevious[size - i - 1];

            dctIn[i] = a - b;
            dctIn[half + i] = c - d;
        }

        this.Dct4(dctIn, output);
        output.set(input, 0);
        this._mdctPrevious.set(input, 0);
    }

    RunImdct(input: Float64Array, output: Float64Array) {
        if (input.length < this.MdctSize || output.length < this.MdctSize) {
            throw new Error("Input and output must be as long as the MDCT size.");
        }

        const size = this.MdctSize;
        const half = size / 2;
        const dctOut = this._scratchMdct;

        this.Dct4(input, dctOut);

        for (let i = 0; i < half; i++) {
            output[i] = this._imdctWindow[i] * dctOut[i + half] + this._imdctPrevious[i];
            output[i + half] = this._imdctWindow[i + half] * -dctOut[size - 1 - i] - this._imdctPrevious[i + half];
            this._imdctPrevious[i] = this._imdctWindow[size - 1 - i] * -dctOut[half - i - 1];
            this._imdctPrevious[i + half] = this._imdctWindow[half - i - 1] * dctOut[i];
        }
    }

    Dct4(input: Float64Array, output: Float64Array) {
        const shuffleTable = Mdct.ShuffleTables[this.MdctBits];
        const sinTable = Mdct.SinTables[this.MdctBits];
        const cosTable = Mdct.CosTables[this.MdctBits];
        const dctTemp = this._scratchDct;

        const size = this.MdctSize;
        const lastIndex = size - 1;
        const halfSize = size / 2;

        for (let i = 0; i < halfSize; i++) {
            const i2 = i * 2;
            const a = input[i2];
            const b = input[lastIndex - i2];
            const sin = sinTable[i];
            const cos = cosTable[i];
            dctTemp[i2] = a * cos + b * sin;
            dctTemp[i2 + 1] = a * sin - b * cos;
        }

        const stageCount = this.MdctBits - 1;

        for (let stage = 0; stage < stageCount; stage++) {
            const blockCount = 1 << stage;
            const blockSizeBits = stageCount - stage;
            const blockHalfSizeBits = blockSizeBits - 1;
            const blockSize = 1 << blockSizeBits;
            const blockHalfSize = 1 << blockHalfSizeBits;
            const sinTable = Mdct.SinTables[blockHalfSizeBits];
            const cosTable = Mdct.CosTables[blockHalfSizeBits];

            for (let block = 0; block < blockCount; block++) {
                for (let i = 0; i < blockHalfSize; i++) {
                    const frontPos = (block * blockSize + i) * 2;
                    const backPos = frontPos + blockSize;
                    const a = dctTemp[frontPos] - dctTemp[backPos];
                    const b = dctTemp[frontPos + 1] - dctTemp[backPos + 1];
                    const sin = sinTable[i];
                    const cos = cosTable[i];
                    dctTemp[frontPos] += dctTemp[backPos];
                    dctTemp[frontPos + 1] += dctTemp[backPos + 1];
                    dctTemp[backPos] = a * cos + b * sin;
                    dctTemp[backPos + 1] = a * sin - b * cos;
                }
            }
        }

        for (let i = 0; i < size; i++) {
            output[i] = dctTemp[shuffleTable[i]] * this.Scale;
        }
    }

    static GenerateTrigTables(sizeBits: number) {
        const size = 1 << sizeBits;

        const sin = new Float64Array(size);
        const cos = new Float64Array(size);

        for (let i = 0; i < size; i++) {
            const value = Math.PI * (4 * i + 1) / (4 * size);
            sin[i] = Math.sin(value);
            cos[i] = Math.cos(value);
        }
        return [sin, cos]
    }

    GenerateShuffleTable(sizeBits: number) {
        const size = 1 << sizeBits;
        const table = new Int32Array(size);

        for (let i = 0; i < size; i++) {
            table[i] = Bit.bitReverse32WithBitCount(i ^ (i / 2), sizeBits);
        }

        return table;
    }
}