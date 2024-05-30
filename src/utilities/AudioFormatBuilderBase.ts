import AudioTrack from "./AudioTrack.js"

export default class AudioFormatBaseBuilder {
    ChannelCount: number = 0
    Looping: boolean = false
    LoopStart: number|null = null
    LoopEnd: number|null = null
    SampleCount: number = 0
    SampleRate: number = 0
    AudioTrack: number = 0
    Tracks?: AudioTrack[]
}