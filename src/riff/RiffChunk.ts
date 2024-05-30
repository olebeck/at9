import BinaryReader from "../utilities/BinaryReader.js";

export default class RiffChunk {
    ChunkId: string;
    Size: number;
    Type: string;
    constructor() {
        this.ChunkId = "";
        this.Size = 0;
        this.Type = "";
    }

    static Parse(reader: BinaryReader) {
        const chunk = new RiffChunk();
        chunk.ChunkId = reader.readUTF8(4);
        chunk.Size = reader.readInt32();
        chunk.Type = reader.readUTF8(4);

        if (chunk.ChunkId !== "RIFF") {
            throw new Error("Not a valid RIFF file");
        }

        return chunk;
    }
}
