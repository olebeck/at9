import BitReader from "../utilities/BitReader.js";
import Helpers from "../utilities/Helpers.js";
import Atrac9Config from "./Atrac9Config.js";
import BandExtension from "./BandExtension.js";
import Block from "./Block.js";
import Frame from "./Frame.js";
import Quantization from "./Quantization.js";
import Stereo from "./Stereo.js";
import Unpack from "./Unpack.js";

export default class Atrac9Decoder {
    Config!: Atrac9Config
    Frame!: Frame
    Reader!: BitReader
    Initialized: boolean
    constructor() {
        this.Initialized = false;
    }

    initialize(configData: Uint8Array) {
        this.Config = new Atrac9Config(configData);
        this.Frame = new Frame(this.Config);
        this.Reader = new BitReader(null);
        this.Initialized = true;
    }

    decode(atrac9Data: Uint8Array, pcmOut: (Float32Array|Uint16Array)[]) {
        if (!this.Initialized) {
            throw new Error("Decoder must be initialized before decoding.");
        }

        this.validateDecodeBuffers(atrac9Data, pcmOut);
        this.Reader.setBuffer(atrac9Data);
        this.decodeSuperFrame(pcmOut);
    }

    validateDecodeBuffers(atrac9Buffer: Uint8Array, pcmBuffer: (Float32Array|Uint16Array)[]) {
        if(!this.Config) {
            throw new Error("uninitialized");
        }
        if (!atrac9Buffer) {
            throw new Error("ATRAC9 buffer is required.");
        }

        if (!pcmBuffer) {
            throw new Error("PCM buffer is required.");
        }

        if (atrac9Buffer.length < this.Config.SuperframeBytes) {
            throw new Error("ATRAC9 buffer is too small.");
        }

        if (pcmBuffer.length < this.Config.ChannelCount) {
            throw new Error("PCM buffer is too small.");
        }

        for (let i = 0; i < this.Config.ChannelCount; i++) {
            if (!pcmBuffer[i] || pcmBuffer[i].length < this.Config.SuperframeSamples) {
                throw new Error("PCM buffer is too small.");
            }
        }
    }

    decodeSuperFrame(pcmOut: (Float32Array|Uint16Array)[]) {
        if(!this.Config || !this.Frame) {
            throw new Error("uninitialized");
        }
        for (let i = 0; i < this.Config.FramesPerSuperframe; i++) {
            this.Frame.FrameIndex = i;
            Atrac9Decoder.decodeFrame(this.Reader, this.Frame);
            if(pcmOut[0] instanceof Float32Array) {
                this.pcmFloatOut(pcmOut as Float32Array[], i * this.Config.FrameSamples);
            } else {
                this.pcmFloatToShort(pcmOut as Uint16Array[], i * this.Config.FrameSamples);
            }
            this.Reader!.alignPosition(8);
        }
    }

    pcmFloatOut(pcmOut: Float32Array[], start: number) {
        if(!this.Config || !this.Frame) {
            throw new Error("uninitialized");
        }
        const endSample = start + this.Config.FrameSamples;
        let channelNum = 0;

        for (const block of this.Frame.Blocks) {
            for (const channel of block.Channels) {
                const pcmSrc = channel.Pcm;
                const pcmDest = pcmOut[channelNum++];

                for (let d = 0, s = start; s < endSample; d++, s++) {
                    pcmDest[s] = pcmSrc[d]/32767;
                }
            }
        }
    }

    pcmFloatToShort(pcmOut: Uint16Array[], start: number) {
        if(!this.Config || !this.Frame) {
            throw new Error("uninitialized");
        }
        const endSample = start + this.Config.FrameSamples;
        let channelNum = 0;

        for (const block of this.Frame.Blocks) {
            for (const channel of block.Channels) {
                const pcmSrc = channel.Pcm;
                const pcmDest = pcmOut[channelNum++];

                for (let d = 0, s = start; s < endSample; d++, s++) {
                    const sample = pcmSrc[d];
                    const roundedSample = Math.floor(sample + 0.5);
                    pcmDest[s] = Helpers.Clamp16(roundedSample);
                }
            }
        }
    }

    static decodeFrame(reader: BitReader, frame: Frame) {
        Unpack.unpackFrame(reader, frame);

        for (const block of frame.Blocks) {
            Quantization.dequantizeSpectra(block);
            Stereo.applyIntensityStereo(block);
            Quantization.scaleSpectrum(block);
            BandExtension.applyBandExtension(block);
            this.imdctBlock(block);
        }
    }

    static imdctBlock(block: Block) {
        for (const channel of block.Channels) {
            channel.Mdct.RunImdct(channel.Spectra, channel.Pcm);
        }
    }
}