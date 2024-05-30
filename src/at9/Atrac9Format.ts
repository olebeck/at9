import AudioFormatBase from "../utilities/AudioFormatBase.js";
import Helpers from "../utilities/Helpers.js";
import Atrac9Config from "./Atrac9Config.js";
import Atrac9Decoder from "./Atrac9Decoder.js";
import Atrac9FormatBuilder from "./Atrac9FormatBuilder.js";

export default class Atrac9Format extends AudioFormatBase {
    AudioData: Uint8Array[]
    Config: Atrac9Config
    EncoderDelay: number
    constructor(builder: Atrac9FormatBuilder) {
        super(builder);
        this.AudioData = builder.AudioData;
        this.Config = builder.Config;
        this.EncoderDelay = builder.EncoderDelay;
    }

    decode(parameters?: {progress: {setTotal: (total: number) => void, reportAdd: (n: number) => void}}) {
        const progress = parameters?.progress;
        progress?.setTotal(this.AudioData.length);

        const decoder = new Atrac9Decoder();
        decoder.initialize(this.Config.ConfigData);
        const config = decoder.Config;
        const pcmOut = Helpers.createJaggedArray(Uint16Array, config.ChannelCount, this.SampleCount);
        const pcmBuffer = Helpers.createJaggedArray(Uint16Array, config.ChannelCount, config.SuperframeSamples);

        for (let i = 0; i < this.AudioData.length; i++) {
            decoder.decode(this.AudioData[i], pcmBuffer);
            this.copyBuffer(pcmBuffer, pcmOut, this.EncoderDelay, i);
            progress?.reportAdd(1);
        }
        return pcmOut;
    }

    copyBuffer(bufferIn: Uint16Array[], bufferOut: Uint16Array[], startIndex: number, bufferIndex: number) {
        if (!bufferIn || !bufferOut || bufferIn.length === 0 || bufferOut.length === 0) {
            throw new Error("bufferIn and bufferOut must be non-null with a length greater than 0");
        }

        const bufferLength = bufferIn[0].length;
        const outLength = bufferOut[0].length;

        const currentIndex = bufferIndex * bufferLength - startIndex;
        const remainingElements = Math.min(outLength - currentIndex, outLength);
        const srcStart = Helpers.Clamp(0 - currentIndex, 0, bufferLength);
        const destStart = Math.max(currentIndex, 0);

        const length = Math.min(bufferLength - srcStart, remainingElements);
        if (length <= 0) return;

        for (let c = 0; c < bufferOut.length; c++) {
            bufferOut[c].set(bufferIn[c].slice(srcStart, srcStart + length), destStart);
        }
    }
}