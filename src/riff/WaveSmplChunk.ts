import BinaryReader from "../utilities/BinaryReader.js";
import RiffParser from "./RiffParser.js";
import RiffSubChunk from "./RiffSubChunk.js";

export type Loop = {
    CuePointId: number;
    Type: number;
    Start: number;
    End: number;
    Fraction: number;
    PlayCount: number;
}

export default class WaveSmplChunk extends RiffSubChunk {
    Manufacturer: number;
    Product: number;
    SamplePeriod: number;
    MidiUnityNote: number;
    MidiPitchFraction: number;
    SmpteFormat: number;
    SmpteOffset: number;
    SampleLoops: number;
    SamplerData: number;
    Loops: Loop[];
    constructor(reader: BinaryReader) {
        super(reader);

        this.Manufacturer = reader.readInt32();
        this.Product = reader.readInt32();
        this.SamplePeriod = reader.readInt32();
        this.MidiUnityNote = reader.readInt32();
        this.MidiPitchFraction = reader.readInt32();
        this.SmpteFormat = reader.readInt32();
        this.SmpteOffset = reader.readInt32();
        this.SampleLoops = reader.readInt32();
        this.SamplerData = reader.readInt32();
        this.Loops = new Array(this.SampleLoops);

        for (let i = 0; i < this.SampleLoops; i++) {
            this.Loops[i] = {
                CuePointId: reader.readInt32(),
                Type: reader.readInt32(),
                Start: reader.readInt32(),
                End: reader.readInt32(),
                Fraction: reader.readInt32(),
                PlayCount: reader.readInt32()
            };
        }
    }

    static Parse(parser: RiffParser, reader: BinaryReader) {
        return new WaveSmplChunk(reader);
    }
}