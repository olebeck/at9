import ArrayUnpacker from "../utilities/ArrayUnpacker.js";
import BitAllocation from "./BitAllocation.js";
import { BlockType } from "./BlockType.js";
import ChannelConfig from "./ChannelConfig.js";
import HuffmanCodebook from "./HuffmanCodebook.js";
import PackedTables from "./PackedTables.js";

function SpectrumScaleFunction(x: number) {
    return Math.pow(2, x - 15);
}

function QuantizerStepSizeFunction(x: number) {
    return 2.0 / ((1 << (x + 1)) - 1);
}

function QuantizerInverseStepSizeFunction(x: number) {
    return 1 / QuantizerStepSizeFunction(x);
}

function QuantizerFineStepSizeFunction(x: number) {
    return QuantizerStepSizeFunction(x) / 65535;
}

export default class Tables {
    static MaxHuffPrecision(highSampleRate: boolean) { return highSampleRate ? 1 : 7 }
    static MinBandCount(highSampleRate: boolean) { return highSampleRate ? 1 : 3 }
    static MaxExtensionBand(highSampleRate: boolean) { return highSampleRate ? 16 : 18 }

    static SampleRates = [
        11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000,
        44100, 48000, 64000, 88200, 96000, 128000, 176400, 192000
    ];

    static SamplingRateIndexToFrameSamplesPower = [6, 6, 7, 7, 7, 8, 8, 8, 6, 6, 7, 7, 7, 8, 8, 8];

    static MaxBandCount = [8, 8, 12, 12, 12, 18, 18, 18, 8, 8, 12, 12, 12, 16, 16, 16];
    static BandToQuantUnitCount = [0, 4, 8, 10, 12, 13, 14, 15, 16, 18, 20, 21, 22, 23, 24, 25, 26, 28, 30];

    static QuantUnitToCoeffCount = [
         2,  2,  2,  2,  2,  2,  2,  2,  4,  4,  4,  4,  8,  8,  8,
         8,  8,  8,  8,  8, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16
    ];

    static QuantUnitToCoeffIndex = [
        0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56,
        64, 72, 80, 88, 96, 112, 128, 144, 160, 176, 192, 208, 224, 240, 256
    ];

    static QuantUnitToCodebookIndex = [
        0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2,
        2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3
    ];

    static ChannelConfig = [
        new ChannelConfig(BlockType.Mono),
        new ChannelConfig(BlockType.Mono, BlockType.Mono),
        new ChannelConfig(BlockType.Stereo),
        new ChannelConfig(BlockType.Stereo, BlockType.Mono, BlockType.LFE, BlockType.Stereo),
        new ChannelConfig(BlockType.Stereo, BlockType.Mono, BlockType.LFE, BlockType.Stereo, BlockType.Stereo),
        new ChannelConfig(BlockType.Stereo, BlockType.Stereo)
    ];

    static HuffmanScaleFactorsUnsigned: HuffmanCodebook[];
    static HuffmanScaleFactorsSigned: HuffmanCodebook[];
    static HuffmanSpectrumA: HuffmanCodebook[][];
    static HuffmanSpectrumB: HuffmanCodebook[][];
    static HuffmanSpectrum: HuffmanCodebook[][][];

    static MdctWindow = [this.GenerateMdctWindow(6), this.GenerateMdctWindow(7), this.GenerateMdctWindow(8)];
    static ImdctWindow = [this.GenerateImdctWindow(6), this.GenerateImdctWindow(7), this.GenerateImdctWindow(8)];

    static SpectrumScale = Array.from({ length: 32 }, (_, x) => SpectrumScaleFunction(x));
    static QuantizerStepSize = Array.from({ length: 16 }, (_, x) => QuantizerStepSizeFunction(x));
    static QuantizerInverseStepSize = Array.from({ length: 16 }, (_, x) => QuantizerInverseStepSizeFunction(x));
    static QuantizerFineStepSize = Array.from({ length: 16 }, (_, x) => QuantizerFineStepSizeFunction(x));

    static GradientCurves = BitAllocation.GenerateGradientCurves();
    static ScaleFactorWeights: Uint32Array[];

    static BexMode0Bands3: Float64Array[];
    static BexMode0Bands4: Float64Array[];
    static BexMode0Bands5: Float64Array[];
    static BexMode2Scale: Float64Array;
    static BexMode3Initial: Float64Array;
    static BexMode3Rate: Float64Array;
    static BexMode4Multiplier: Float64Array;

    static BexGroupInfo: Uint8Array[];
    static BexEncodedValueCounts: Uint8Array[];
    static BexDataLengths: Uint8Array[][];

    static Init = (async () => {
        const arrays = await ArrayUnpacker.UnpackArrays(PackedTables.Tables);
    
        Tables.HuffmanSpectrumA = PackedTables.GenerateHuffmanCodebooks3(arrays[4], arrays[0], arrays[6]);
        Tables.HuffmanSpectrumB = PackedTables.GenerateHuffmanCodebooks3(arrays[5], arrays[1], arrays[7]);
        Tables.HuffmanSpectrum = [Tables.HuffmanSpectrumA, Tables.HuffmanSpectrumB];
    
        Tables.HuffmanScaleFactorsUnsigned = PackedTables.GenerateHuffmanCodebooks2(arrays[9], arrays[2], arrays[8]);
        Tables.HuffmanScaleFactorsSigned = PackedTables.GenerateHuffmanCodebooks2(arrays[10], arrays[3], arrays[8]);
    
        Tables.ScaleFactorWeights = arrays[11];
    
        Tables.BexGroupInfo = arrays[12];
        Tables.BexEncodedValueCounts = arrays[13];
        Tables.BexDataLengths = arrays[14];
    
        Tables.BexMode0Bands3 = arrays[15];
        Tables.BexMode0Bands4 = arrays[16];
        Tables.BexMode0Bands5 = arrays[17];
        Tables.BexMode2Scale = arrays[18];
        Tables.BexMode3Initial = arrays[19];
        Tables.BexMode3Rate = arrays[20];
        Tables.BexMode4Multiplier = arrays[21];
    })();

    private static GenerateImdctWindow(frameSizePower: number) {
        const frameSize = 1 << frameSizePower;
        const output = new Float64Array(frameSize);

        const a1 = this.GenerateMdctWindow(frameSizePower);

        for (let i = 0; i < frameSize; i++)
        {
            output[i] = a1[i] / (a1[frameSize - 1 - i] * a1[frameSize - 1 - i] + a1[i] * a1[i]);
        }
        return output;
    }

    private static GenerateMdctWindow(frameSizePower: number)
    {
        const frameSize = 1 << frameSizePower;
        const output = new Float64Array(frameSize);

        for (let i = 0; i < frameSize; i++)
        {
            output[i] = (Math.sin(((i + 0.5) / frameSize - 0.5) * Math.PI) + 1.0) * 0.5;
        }

        return output;
    }
}
