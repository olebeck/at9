import BitReader from "../utilities/BitReader.js";
import InvalidDataException from "../utilities/InvalidDataException.js";
import Channel from "./Channel.js";
import Tables from "./Tables.js";
import Unpack from "./Unpack.js";

export default class ScaleFactors {
    static read(reader: BitReader, channel: Channel) {
        channel.ScaleFactors.fill(0);

        channel.ScaleFactorCodingMode = reader.readInt(2);

        if (channel.ChannelIndex === 0) {
            switch (channel.ScaleFactorCodingMode) {
                case 0:
                    ScaleFactors.readVlcDeltaOffset(reader, channel);
                    break;
                case 1:
                    ScaleFactors.readClcOffset(reader, channel);
                    break;
                case 2:
                    if (channel.Block.FirstInSuperframe) throw new InvalidDataException();
                    ScaleFactors.readVlcDistanceToBaseline(reader, channel, channel.ScaleFactorsPrev, channel.Block.QuantizationUnitsPrev);
                    break;
                case 3:
                    if (channel.Block.FirstInSuperframe) throw new InvalidDataException();
                    ScaleFactors.readVlcDeltaOffsetWithBaseline(reader, channel, channel.ScaleFactorsPrev, channel.Block.QuantizationUnitsPrev);
                    break;
            }
        } else {
            switch (channel.ScaleFactorCodingMode) {
                case 0:
                    ScaleFactors.readVlcDeltaOffset(reader, channel);
                    break;
                case 1:
                    ScaleFactors.readVlcDistanceToBaseline(reader, channel, channel.Block.Channels[0].ScaleFactors, channel.Block.ExtensionUnit);
                    break;
                case 2:
                    ScaleFactors.readVlcDeltaOffsetWithBaseline(reader, channel, channel.Block.Channels[0].ScaleFactors, channel.Block.ExtensionUnit);
                    break;
                case 3:
                    if (channel.Block.FirstInSuperframe) throw new InvalidDataException();
                    ScaleFactors.readVlcDistanceToBaseline(reader, channel, channel.ScaleFactorsPrev, channel.Block.QuantizationUnitsPrev);
                    break;
            }
        }

        for (let i = 0; i < channel.Block.ExtensionUnit; i++) {
            if (channel.ScaleFactors[i] < 0 || channel.ScaleFactors[i] > 31) {
                throw new InvalidDataException("Scale factor values are out of range.");
            }
        }

        channel.ScaleFactorsPrev.set(channel.ScaleFactors);
    }

    static readClcOffset(reader: BitReader, channel: Channel) {
        const maxBits = 5;
        const sf = channel.ScaleFactors;
        const bitLength = reader.readInt(2) + 2;
        const baseValue = bitLength < maxBits ? reader.readInt(maxBits) : 0;

        for (let i = 0; i < channel.Block.ExtensionUnit; i++) {
            sf[i] = reader.readInt(bitLength) + baseValue;
        }
    }

    static readVlcDeltaOffset(reader: BitReader, channel: Channel) {
        const weightIndex = reader.readInt(3);
        const weights = Tables.ScaleFactorWeights[weightIndex];

        const sf = channel.ScaleFactors;
        const baseValue = reader.readInt(5);
        const bitLength = reader.readInt(2) + 3;
        const codebook = Tables.HuffmanScaleFactorsUnsigned[bitLength];

        sf[0] = reader.readInt(bitLength);

        for (let i = 1; i < channel.Block.ExtensionUnit; i++) {
            const delta = Unpack.readHuffmanValue(codebook, reader);
            sf[i] = (sf[i - 1] + delta) & (codebook.ValueMax - 1);
        }

        for (let i = 0; i < channel.Block.ExtensionUnit; i++) {
            sf[i] += baseValue - weights[i];
        }
    }

    static readVlcDistanceToBaseline(reader: BitReader, channel: Channel, baseline: Int8Array, baselineLength: number) {
        const sf = channel.ScaleFactors;
        const bitLength = reader.readInt(2) + 2;
        const codebook = Tables.HuffmanScaleFactorsSigned![bitLength];
        const unitCount = Math.min(channel.Block.ExtensionUnit, baselineLength);

        for (let i = 0; i < unitCount; i++) {
            const distance = Unpack.readHuffmanValue(codebook, reader, true);
            sf[i] = (baseline[i] + distance) & 31;
        }

        for (let i = unitCount; i < channel.Block.ExtensionUnit; i++) {
            sf[i] = reader.readInt(5);
        }
    }

    static readVlcDeltaOffsetWithBaseline(reader: BitReader, channel: Channel, baseline: Int8Array, baselineLength: number) {
        const sf = channel.ScaleFactors;
        const baseValue = reader.readOffsetBinary(5, BitReader.OffsetBias.Negative);
        const bitLength = reader.readInt(2) + 1;
        const codebook = Tables.HuffmanScaleFactorsUnsigned![bitLength];
        const unitCount = Math.min(channel.Block.ExtensionUnit, baselineLength);

        sf[0] = reader.readInt(bitLength);

        for (let i = 1; i < unitCount; i++) {
            const delta = Unpack.readHuffmanValue(codebook, reader);
            sf[i] = (sf[i - 1] + delta) & (codebook.ValueMax - 1);
        }

        for (let i = 0; i < unitCount; i++) {
            sf[i] += baseValue + baseline[i];
        }

        for (let i = unitCount; i < channel.Block.ExtensionUnit; i++) {
            sf[i] = reader.readInt(5);
        }
    }
}