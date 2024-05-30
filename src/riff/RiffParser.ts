import BinaryReader from "../utilities/BinaryReader.js";
import RiffChunk from "./RiffChunk.js";
import RiffSubChunk from "./RiffSubChunk.js";
import WaveDataChunk from "./WaveDataChunk.js";
import WaveFactChunk from "./WaveFactChunk.js";
import WaveFmtChunk from "./WaveFmtChunk.js";
import WaveFormatExtensible from "./WaveFormatExtensible.js";
import WaveSmplChunk from "./WaveSmplChunk.js";

export default class RiffParser {
    RiffChunk: RiffChunk|null;
    ReadDataChunk: boolean;
    SubChunks: {[k: string]: RiffSubChunk};
    RegisteredSubChunks: {[k: string]: (parser: RiffParser, reader: BinaryReader) => RiffSubChunk};
    FormatExtensibleParser: (parser: RiffParser, reader: BinaryReader) => WaveFormatExtensible
    constructor() {
        this.RiffChunk = null;
        this.ReadDataChunk = true;
        this.SubChunks = {};
        this.RegisteredSubChunks = {
            "fmt ": WaveFmtChunk.Parse,
            "smpl": WaveSmplChunk.Parse,
            "fact": WaveFactChunk.Parse,
            "data": WaveDataChunk.Parse
        };
        this.FormatExtensibleParser = WaveFormatExtensible.Parse;
    }

    RegisterSubChunk(id: string, subChunkReader: (parser: RiffParser, reader: BinaryReader) => RiffSubChunk) {
        if (id.length !== 4) {
            throw new Error("Subchunk ID must be 4 characters long");
        }

        this.RegisteredSubChunks[id] = subChunkReader;
    }

    ParseRiff(file: ArrayBuffer) {
        // Assuming you have a suitable BinaryReader-like mechanism
        const reader = new BinaryReader(file);
        this.RiffChunk = RiffChunk.Parse(reader);
        this.SubChunks = {};

        // Size is counted from after the ChunkSize field, not the RiffType field
        const startOffset = reader.position - 4;
        const endOffset = startOffset + this.RiffChunk.Size;

        // Make sure 8 bytes are available for the subchunk header
        while (reader.position + 8 < endOffset) {
            const subChunk = this.ParseSubChunk(reader);
            this.SubChunks[subChunk.SubChunkId] = subChunk;
        }
    }

    GetAllSubChunks() {
        return Object.values(this.SubChunks);
    }

    GetSubChunk(id: string) {
        return this.SubChunks[id];
    }

    ParseSubChunk(reader: BinaryReader) {
        const id = reader.readUTF8(4);
        reader.position -= 4;
        const startOffset = reader.position + 8;

        const parser = this.RegisteredSubChunks[id];
        const subChunk = parser ? parser(this, reader) : new RiffSubChunk(reader);

        const endOffset = startOffset + subChunk.SubChunkSize;
        const remainingBytes = Math.max(endOffset - reader.position, 0);
        subChunk.Extra = reader.readBytes(remainingBytes);

        reader.position = endOffset + (endOffset & 1); // Subchunks are 2-byte aligned
        return subChunk;
    }
}