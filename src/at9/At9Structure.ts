import Atrac9Config from "./Atrac9Config.js"

export default class At9Structure {
    Config: Atrac9Config|null
    AudioData: Uint8Array[]
    SampleCount: number
    Version: number
    EncoderDelay: number
    SuperframeCount: number
    Looping: boolean
    LoopStart: number
    LoopEnd: number
    constructor() {
        this.Config = null;
        this.AudioData = [];
        this.SampleCount = 0;
        this.Version = 0;
        this.EncoderDelay = 0;
        this.SuperframeCount = 0;
        this.Looping = false;
        this.LoopStart = 0;
        this.LoopEnd = 0;
    }
}