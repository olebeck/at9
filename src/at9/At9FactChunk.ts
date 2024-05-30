import BinaryReader from "../utilities/BinaryReader.js";
import RiffParser from "../riff/RiffParser.js";
import WaveFactChunk from "../riff/WaveFactChunk.js";

export default class At9FactChunk extends WaveFactChunk {
    InputOverlapDelaySamples: number
    EncoderDelaySamples: number
    constructor(reader: BinaryReader) {
        super(reader);
        this.InputOverlapDelaySamples = reader.readInt32();
        this.EncoderDelaySamples = reader.readInt32();
    }

    static parseAt9(parser: RiffParser, reader: BinaryReader) {
        return new At9FactChunk(reader);
    }
}