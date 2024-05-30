import Mdct from "../utilities/Mdct.js"
import Atrac9Config from "./Atrac9Config.js"
import Block from "./Block.js"
import Tables from "./Tables.js"

export default class Channel {
    Block: Block
    ChannelIndex: number
    Config: Atrac9Config
    Mdct: Mdct

    Pcm: Float64Array
    Spectra: Float64Array

    CodedQuantUnits: number
    ScaleFactorCodingMode: number

    ScaleFactors: Int8Array
    ScaleFactorsPrev: Int8Array
    Precisions: Int8Array
    PrecisionsFine: Int8Array
    PrecisionMask: number[]
    SpectraValuesBuffer: Int32Array
    CodebookSet: number[]
    QuantizedSpectra: Int32Array
    QuantizedSpectraFine: number[]

    BexMode: number
    BexValueCount: number
    BexValues: number[]
    BexScales: number[]
    Rng: Atrac9Rng|null

    constructor(parentBlock: Block, channelIndex: number) {
        this.Block = parentBlock;
        this.ChannelIndex = channelIndex;
        this.Config = parentBlock.Config;
        this.Mdct = new Mdct(this.Config.FrameSamplesPower, Tables.ImdctWindow[this.Config.FrameSamplesPower - 6]);
        
        this.Pcm = new Float64Array(256).fill(0);
        this.Spectra = new Float64Array(256).fill(0);

        this.CodedQuantUnits = 0;
        this.ScaleFactorCodingMode = 0;
        this.ScaleFactors = new Int8Array(31);
        this.ScaleFactorsPrev = new Int8Array(31);

        this.Precisions = new Int8Array(30);
        this.PrecisionsFine = new Int8Array(30);
        this.PrecisionMask = new Array(30).fill(0);

        this.SpectraValuesBuffer = new Int32Array(16);
        this.CodebookSet = new Array(30).fill(0);

        this.QuantizedSpectra = new Int32Array(256);
        this.QuantizedSpectraFine = new Array(256).fill(0);

        this.BexMode = 0;
        this.BexValueCount = 0;
        this.BexValues = new Array(4).fill(0);
        this.BexScales = new Array(6).fill(0);
        this.Rng = null;
    }

    get IsPrimary() { return this.Block.PrimaryChannelIndex == this.ChannelIndex; } 

    updateCodedUnits() {
        this.CodedQuantUnits = this.IsPrimary ? this.Block.QuantizationUnitCount : this.Block.StereoQuantizationUnit;
    }
}