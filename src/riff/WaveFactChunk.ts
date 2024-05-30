import BinaryReader from "../utilities/BinaryReader.js";
import RiffParser from "./RiffParser.js";
import RiffSubChunk from "./RiffSubChunk.js";

export default class WaveFactChunk extends RiffSubChunk {
    SampleCount: number
    constructor(reader: BinaryReader) {
        super(reader);

        this.SampleCount = reader.readInt32();
    }

    static Parse(parser: RiffParser, reader: BinaryReader) {
        return new WaveFactChunk(reader);
    }
}