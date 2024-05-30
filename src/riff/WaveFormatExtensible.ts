import BinaryReader from "../utilities/BinaryReader.js"
import UUID from "../utilities/UUID.js"
import RiffParser from "./RiffParser.js"

export default class WaveFormatExtensible {
    Size: number
    ValidBitsPerSample: number
    SamplesPerBlock: number
    ChannelMask: number
    SubFormat: UUID
    Extra: null|Uint8Array
    constructor(reader: BinaryReader) {
        this.Size = reader.readInt16();
        this.ValidBitsPerSample = reader.readInt16();
        this.SamplesPerBlock = this.ValidBitsPerSample;
        this.ChannelMask = reader.readUInt32();
        this.SubFormat = new UUID(reader.readBytes(16));
        this.Extra = null;
    }

    static Parse(parser: RiffParser, reader: BinaryReader) {
        return new WaveFormatExtensible(reader);
    }
}