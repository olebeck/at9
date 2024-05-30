import BinaryReader from "../utilities/BinaryReader.js";
import RiffParser from "../riff/RiffParser.js";
import RiffSubChunk from "../riff/RiffSubChunk.js";
import WaveFmtChunk from "../riff/WaveFmtChunk.js";
import At9FactChunk from "./At9FactChunk.js";
import At9WaveExtensible from "./At9WaveExtensible.js";
import Atrac9Config from "./Atrac9Config.js";

export default class At9DataChunk extends RiffSubChunk {
    FrameCount: number
    AudioData: Uint8Array[]

    constructor(parser: RiffParser, reader: BinaryReader) {
        super(reader);

        // Do not trust the BlockAlign field in the fmt chunk to equal the superframe size.
        // Some AT9 files have an invalid number in there.
        // Calculate the size using the ATRAC9 DataConfig instead.

        let ext = parser.GetSubChunk("fmt ");
        if (ext instanceof WaveFmtChunk && ext.Ext instanceof At9WaveExtensible) {
            let fact = parser.GetSubChunk("fact");
            if (!(fact instanceof At9FactChunk)) {
                throw new Error("fact chunk must come before data chunk");
            }

            let config = new Atrac9Config(ext.Ext.ConfigData);
            this.FrameCount = Math.ceil((fact.SampleCount + fact.EncoderDelaySamples) / config.SuperframeSamples);
            let dataSize = this.FrameCount * config.SuperframeBytes;

            if (dataSize > reader.length - reader.position) {
                throw new Error("Required AT9 length is greater than the number of bytes remaining in the file.");
            }

            this.AudioData = reader.deInterleave(dataSize, config.SuperframeBytes, this.FrameCount);
        } else {
            throw new Error("fmt chunk must come before data chunk");
        }
    }

    static parseAt9(parser: RiffParser, reader: BinaryReader) {
        return new At9DataChunk(parser, reader);
    }
}