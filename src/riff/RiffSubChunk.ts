import BinaryReader from "../utilities/BinaryReader.js";

export default class RiffSubChunk {
    SubChunkId: string
    SubChunkSize: number
    Extra: any
    constructor(reader: BinaryReader) {
        this.SubChunkId = reader.readUTF8(4);
        this.SubChunkSize = reader.readInt32();
        this.Extra = null; // You may read the extra data here if needed
    }
}