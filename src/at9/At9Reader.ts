import { MediaSubtypes } from "../riff/MediaSubtypes.js";
import RiffParser from "../riff/RiffParser.js";
import WaveFmtChunk from "../riff/WaveFmtChunk.js";
import WaveSmplChunk from "../riff/WaveSmplChunk.js";
import AudioReader from "../utilities/AudioReader.js";
import At9Configuration from "./At9Configuration.js";
import At9DataChunk from "./At9DataChunk.js";
import At9FactChunk from "./At9FactChunk.js";
import At9Structure from "./At9Structure.js";
import At9WaveExtensible from "./At9WaveExtensible.js";
import Atrac9Config from "./Atrac9Config.js";
import Atrac9FormatBuilder from "./Atrac9FormatBuilder.js";
import Tables from "./Tables.js";

export default class At9Reader extends AudioReader {
    static Init = Promise.all([Tables.Init]);

    constructor() {
        super();
        this.TConfig = At9Configuration;
    }

    readFile(stream: ArrayBuffer, readAudioData = true) {
        const structure = new At9Structure();
        const parser = new RiffParser();
        parser.ReadDataChunk = readAudioData;
        parser.RegisterSubChunk("fact", At9FactChunk.parseAt9);
        parser.RegisterSubChunk("data", At9DataChunk.parseAt9);
        parser.FormatExtensibleParser = At9WaveExtensible.parseAt9;
        parser.ParseRiff(stream);

        this.validateAt9File(parser);

        const fmt = parser.GetSubChunk("fmt ") as WaveFmtChunk;
        const ext = fmt.Ext as At9WaveExtensible;
        const fact = parser.GetSubChunk("fact") as At9FactChunk;
        const data = parser.GetSubChunk("data") as At9DataChunk;
        const smpl = parser.GetSubChunk("smpl") as WaveSmplChunk;

        structure.Config = new Atrac9Config(ext.ConfigData);
        structure.SampleCount = fact.SampleCount;
        structure.EncoderDelay = fact.EncoderDelaySamples;
        structure.Version = ext.VersionInfo;
        structure.AudioData = data.AudioData;
        structure.SuperframeCount = data.FrameCount;

        if (smpl?.Loops?.[0]) {
            structure.LoopStart = smpl.Loops[0].Start - structure.EncoderDelay;
            structure.LoopEnd = smpl.Loops[0].End - structure.EncoderDelay;
            structure.Looping = structure.LoopEnd > structure.LoopStart;
        }

        return structure;
    }

    toAudioStream(structure: At9Structure) {
        return new Atrac9FormatBuilder(structure.AudioData, structure.Config!, structure.SampleCount, structure.EncoderDelay)
            .withLoop(structure.Looping, structure.LoopStart, structure.LoopEnd)
            .build();
    }

    validateAt9File(parser: RiffParser) {
        if (parser.RiffChunk?.Type !== "WAVE") {
            throw new Error("Not a valid WAVE file");
        }

        const fmt = parser.GetSubChunk("fmt ") as WaveFmtChunk;
        if(!fmt) throw new Error("File must have a valid fmt chunk");
        if(!fmt.Ext) throw new Error("File must have a format chunk extension");
        const ext = fmt.Ext;
        
        if (!parser.GetSubChunk("fact")) {
            throw new Error("File must have a valid fact chunk");
        }

        if (!parser.GetSubChunk("data")) {
            throw new Error("File must have a valid data chunk");
        }

        if (fmt.ChannelCount === 0) {
            throw new Error("Channel count must not be zero");
        }

        if (indexedDB.cmp(ext.SubFormat.bytes, MediaSubtypes.mediaSubtypeAtrac9) !== 0) {
            throw new Error(`Must contain ATRAC9 data. Has unsupported SubFormat ${ext.SubFormat}`);
        }
    }
}