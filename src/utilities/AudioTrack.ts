export default class AudioTrack {
    channelCount: number
    channelLeft: number
    channelRight: number
    panning: number
    volume: number
    surroundPanning: number
    flags: number
    constructor(channelCount: number, channelLeft: number, channelRight: number, panning: number, volume: number) {
        this.channelCount = channelCount;
        this.channelLeft = channelLeft;
        this.channelRight = channelRight;
        this.panning = panning;
        this.volume = volume;
        this.surroundPanning = 0;
        this.flags = 0;
    }

    static getDefaultTrackList(channelCount: number) {
        const trackCount = Math.ceil(channelCount / 2);
        const tracks: AudioTrack[] = [];

        for (let i = 0; i < trackCount; i++) {
            const trackChannelCount = Math.min(channelCount - i * 2, 2);
            tracks.push(new AudioTrack(
                trackChannelCount,
                i * 2, trackChannelCount >= 2 ? i * 2 + 1 : 0,
                0, 0
            ));
        }

        return tracks;
    }
}