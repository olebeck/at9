import AudioTrack from "./AudioTrack.js"
import AudioFormatBuilderBase from "./AudioFormatBuilderBase.js"

export default class AudioFormatBase {
    _tracks: AudioTrack[]
    SampleRate: number
    ChannelCount: number
    UnalignedSampleCount: number
    UnalignedLoopStart: number
    UnalignedLoopEnd: number
    Looping: boolean
    Tracks: AudioTrack[]
    constructor(builder: AudioFormatBuilderBase) {
        this._tracks = builder.Tracks || [];
        this.SampleRate = builder.SampleRate;
        this.ChannelCount = builder.ChannelCount;
        this.UnalignedSampleCount = builder.SampleCount;
        this.UnalignedLoopStart = builder.LoopStart ?? 0;
        this.UnalignedLoopEnd = builder.LoopEnd ?? 0;
        this.Looping = builder.Looping;
        this.Tracks = this._tracks.length > 0 ? this._tracks : AudioTrack.getDefaultTrackList(this.ChannelCount);
    }

    get SampleCount() { return this.UnalignedSampleCount };
    get LoopStart() { return this.UnalignedLoopStart };
    get LoopEnd() { return this.UnalignedLoopEnd };
}