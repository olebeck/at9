import BinaryReader from "../utilities/BinaryReader.js";
import RiffParser from "./RiffParser.js";
import RiffSubChunk from "./RiffSubChunk.js";

export default class WaveDataChunk extends RiffSubChunk {
    Data: Uint8Array|undefined
    constructor(parser: RiffParser, reader: BinaryReader) {
        super(reader);

        if (parser.ReadDataChunk) {
            this.Data = reader.readBytes(this.SubChunkSize);
        }
    }

    static Parse(parser: RiffParser, reader: BinaryReader) {
        return new WaveDataChunk(parser, reader);
    }
}