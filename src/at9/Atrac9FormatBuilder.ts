import AudioFormatBaseBuilder from "../utilities/AudioFormatBuilderBase.js"
import Atrac9Config from "./Atrac9Config.js"
import Atrac9Format from "./Atrac9Format.js"

export default class Atrac9FormatBuilder extends AudioFormatBaseBuilder {
    Config: Atrac9Config
    AudioData: any
    SampleRate: number
    SampleCount: number
    EncoderDelay: number
    constructor(audioData: Uint8Array[], config: Atrac9Config, sampleCount: number, encoderDelay: number) {
        super();
        if (!audioData || !config) {
            throw new Error("audioData and config are required parameters");
        }

        this.Config = config;
        this.AudioData = audioData;
        this.SampleRate = config.SampleRate;
        this.SampleCount = sampleCount;
        this.EncoderDelay = encoderDelay;
    }

    // Method to set loop parameters
    withLoop(looping: boolean, loopStart: number, loopEnd: number) {
        this.LoopStart = loopStart;
        this.LoopEnd = loopEnd;
        this.Looping = looping;
        return this; // Return the builder object for chaining
    }

    // Method to build Atrac9Format
    build() {
        return new Atrac9Format(this);
    }
}