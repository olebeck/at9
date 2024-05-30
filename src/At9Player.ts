import At9Reader from "./at9/At9Reader.js";
import Atrac9Decoder from "./at9/Atrac9Decoder.js";
import Atrac9Format from "./at9/Atrac9Format.js";
import Helpers from "./utilities/Helpers.js";

export default class At9Player extends EventTarget {
    static reader = new At9Reader();
    static zero = new Float32Array(1024);

    audioContext!: AudioContext
    scriptNode?: ScriptProcessorNode

    decoder: Atrac9Decoder
    pcmBuffer?: Float32Array[]
    currentStream?: Atrac9Format;
    currentFrame = 0;
    endFrame = 0;
    isPaused = false;

    constructor() {
        super();
        this.decoder = new Atrac9Decoder();
    }

    initialize() {
        if(this.audioContext) return;
        this.audioContext = new AudioContext();
    }

    async playUrl(url: string) {
        console.log("playUrl", url);
        const r = await fetch(url);
        this.play(await r.arrayBuffer());
    }

    play(buffer: ArrayBuffer) {
        this.initialize();
        this.stop();

        const stream = At9Player.reader.readStream(buffer);
        const audio = stream.audio as Atrac9Format;
        this.currentStream = audio;
        this.currentFrame = 0;
        this.endFrame = (audio.Looping ? audio.LoopEnd+audio.EncoderDelay : audio.SampleCount) / audio.Config.SuperframeSamples;

        this.decoder.initialize(audio.Config.ConfigData);
        this.pcmBuffer = Helpers.createJaggedArray(Float32Array, audio.Config.ChannelCount, audio.Config.SuperframeSamples);
        
        this.scriptNode = this.audioContext.createScriptProcessor(audio.Config.SuperframeSamples, 0, audio.Config.ChannelCount);
        this.scriptNode.onaudioprocess = (ev) => {this.onAudioProcess(ev)};
        this.scriptNode.connect(this.audioContext.destination);
        this.dispatchEvent(new Event("play"));
        this.isPaused = false;
    }

    togglePause() {
        this.isPaused = !this.isPaused;
    }

    stop() {
        this.dispatchEvent(new Event("ended"));
        this.scriptNode?.disconnect();
        this.scriptNode = undefined;
        this.currentStream = undefined;
        this.currentFrame = 0;
        this.pcmBuffer = undefined;
    }

    private onAudioProcess(ev: AudioProcessingEvent) {
        if(!this.currentStream || this.isPaused) {
            for(let i = 0; i < (this.currentStream?.Config?.ChannelCount ?? 1); i++) {
                ev.outputBuffer.copyToChannel(At9Player.zero, i);
            }
        } else {
            const frame = this.currentStream.AudioData[this.currentFrame];
            this.decoder.decode(frame, this.pcmBuffer!);
            for(let i = 0; i < this.currentStream.Config.ChannelCount; i++) {
                ev.outputBuffer.copyToChannel(this.pcmBuffer![i], i);
            }
            this.currentFrame++;
            if(this.currentFrame > this.endFrame) {
                if(this.currentStream.Looping) {
                    this.currentFrame = Math.floor((this.currentStream.LoopStart+this.currentStream.EncoderDelay) / this.currentStream.Config.SuperframeSamples);
                } else {
                    this.stop();
                }
            }
        }
    }
}