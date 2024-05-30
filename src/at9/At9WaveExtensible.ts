import RiffParser from "../riff/RiffParser.js";
import WaveFormatExtensible from "../riff/WaveFormatExtensible.js";
import BinaryReader from "../utilities/BinaryReader.js";

export default class At9WaveExtensible extends WaveFormatExtensible {
    VersionInfo: number
    ConfigData: Uint8Array
    Reserved: number
    constructor(reader: BinaryReader) {
        super(reader);
        this.VersionInfo = reader.readInt32();
        this.ConfigData = reader.readBytes(4);
        this.Reserved = reader.readInt32();
    }

    static parseAt9(parser: RiffParser, reader: BinaryReader) {
        return new At9WaveExtensible(reader);
    }
}