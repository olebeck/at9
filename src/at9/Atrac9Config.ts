import BitReader from "../utilities/BitReader.js"
import ChannelConfig from "./ChannelConfig.js"
import Tables from "./Tables.js"

export default class Atrac9Config {
    ConfigData: Uint8Array
    SampleRateIndex: number
    ChannelConfigIndex: number
    FrameBytes: number
    SuperframeIndex: number

    FramesPerSuperframe: number
    SuperframeBytes: number
    ChannelConfig: ChannelConfig

    ChannelCount: number
    SampleRate: number
    HighSampleRate: boolean
    FrameSamplesPower: number
    FrameSamples: number
    SuperframeSamples: number

    constructor(configData: Uint8Array) {
        if (!configData || configData.length !== 4) {
            throw new Error("Config data must be 4 bytes long");
        }
        {
            const reader = new BitReader(configData);
            const header = reader.readInt(8);
            this.SampleRateIndex = reader.readInt(4);
            this.ChannelConfigIndex = reader.readInt(3);
            const validationBit = reader.readInt(1);
            this.FrameBytes = reader.readInt(11) + 1;
            this.SuperframeIndex = reader.readInt(2);

            if (header !== 0xFE || validationBit !== 0) {
                throw new Error("ATRAC9 Config Data is invalid");
            }
            this.ConfigData = configData;
        }

        this.FramesPerSuperframe = 1 << this.SuperframeIndex;
        this.SuperframeBytes = this.FrameBytes << this.SuperframeIndex;
        this.ChannelConfig = Tables.ChannelConfig[this.ChannelConfigIndex];

        this.ChannelCount = this.ChannelConfig.ChannelCount;
        this.SampleRate = Tables.SampleRates[this.SampleRateIndex];
        this.HighSampleRate = this.SampleRateIndex > 7;
        this.FrameSamplesPower = Tables.SamplingRateIndexToFrameSamplesPower[this.SampleRateIndex];
        this.FrameSamples = 1 << this.FrameSamplesPower;
        this.SuperframeSamples = this.FrameSamples * this.FramesPerSuperframe;
    }

}