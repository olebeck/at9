import BinaryReader from "../utilities/BinaryReader.js";
import { WaveFormatTags } from "./MediaSubtypes.js";
import RiffParser from "./RiffParser.js";
import RiffSubChunk from "./RiffSubChunk.js";
import WaveFormatExtensible from "./WaveFormatExtensible.js";

export default class WaveFmtChunk extends RiffSubChunk {
    FormatTag: number;
    ChannelCount: number;
    SampleRate: number;
    AvgBytesPerSec: number;
    BlockAlign: number;
    BitsPerSample: number;
    Ext: WaveFormatExtensible|null;
    constructor(parser: RiffParser, reader: BinaryReader) {
        super(reader);

        this.FormatTag = reader.readUInt16();
        this.ChannelCount = reader.readInt16();
        this.SampleRate = reader.readInt32();
        this.AvgBytesPerSec = reader.readInt32();
        this.BlockAlign = reader.readInt16();
        this.BitsPerSample = reader.readInt16();
        this.Ext = null;

        if (this.FormatTag === WaveFormatTags.WaveFormatExtensible && parser.FormatExtensibleParser) {
            const startOffset = reader.position + 2;
            this.Ext = parser.FormatExtensibleParser(parser, reader);
            if(this.Ext) {
                const endOffset = startOffset + this.Ext.Size;
                const remainingBytes = Math.max(endOffset - reader.position, 0);
                this.Ext.Extra = reader.readBytes(remainingBytes);
            }
        }
    }

    static Parse(parser: RiffParser, reader: BinaryReader) {
        return new WaveFmtChunk(parser, reader);
    }
}
