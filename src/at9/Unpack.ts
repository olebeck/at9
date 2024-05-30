import Bit from "../utilities/Bit.js";
import BitReader from "../utilities/BitReader.js";
import InvalidDataException from "../utilities/InvalidDataException.js";
import BandExtension from "./BandExtension.js";
import BitAllocation from "./BitAllocation.js";
import Block from "./Block.js";
import { BlockType } from "./BlockType.js";
import Channel from "./Channel.js";
import Frame from "./Frame.js";
import HuffmanCodebook from "./HuffmanCodebook.js";
import ScaleFactors from "./ScaleFactors.js";
import Tables from "./Tables.js";

export default class Unpack {
    static unpackFrame(reader: BitReader, frame: Frame) {
        for (const block of frame.Blocks) {
            Unpack.unpackBlock(reader, block);
        }
    }

    static unpackBlock(reader: BitReader, block: Block) {
        Unpack.readBlockHeader(reader, block);

        if (block.BlockType === BlockType.LFE) {
            Unpack.unpackLfeBlock(reader, block);
        } else {
            Unpack.unpackStandardBlock(reader, block);
        }

        reader.alignPosition(8);
    }

    static readBlockHeader(reader: BitReader, block: Block) {
        const firstInSuperframe = block.Frame.FrameIndex === 0;
        block.FirstInSuperframe = !reader.readBool();
        block.ReuseBandParams = reader.readBool();

        if (block.FirstInSuperframe !== firstInSuperframe) {
            throw new InvalidDataException();
        }

        if (firstInSuperframe && block.ReuseBandParams && block.BlockType !== BlockType.LFE) {
            throw new InvalidDataException();
        }
    }

    static unpackStandardBlock(reader: BitReader, block: Block) {
        const channels = block.Channels;

        if (!block.ReuseBandParams) {
            Unpack.readBandParams(reader, block);
        }

        Unpack.readGradientParams(reader, block);
        BitAllocation.createGradient(block);
        Unpack.readStereoParams(reader, block);
        Unpack.readExtensionParams(reader, block);

        for (const channel of channels) {
            channel.updateCodedUnits();

            ScaleFactors.read(reader, channel);
            BitAllocation.calculateMask(channel);
            BitAllocation.calculatePrecisions(channel);
            Unpack.calculateSpectrumCodebookIndex(channel);

            Unpack.readSpectra(reader, channel);
            Unpack.readSpectraFine(reader, channel);
        }

        block.QuantizationUnitsPrev = block.bandExtensionEnabled ? block.ExtensionUnit : block.QuantizationUnitCount;
    }

    static readBandParams(reader: BitReader, block: Block) {
        const minBandCount = Tables.MinBandCount(block.Config.HighSampleRate);
        const maxExtensionBand = Tables.MaxExtensionBand(block.Config.HighSampleRate);

        block.BandCount = reader.readInt(4);
        block.BandCount += minBandCount;
        block.QuantizationUnitCount = Tables.BandToQuantUnitCount[block.BandCount];
        
        if (block.BandCount > Tables.MaxBandCount[block.Config.SampleRateIndex]) {
            throw new InvalidDataException();
        }

        if (block.BlockType === BlockType.Stereo) {
            block.StereoBand = reader.readInt(4);
            block.StereoBand += minBandCount;
            block.StereoQuantizationUnit = Tables.BandToQuantUnitCount[block.StereoBand];
        } else {
            block.StereoBand = block.BandCount;
        }

        if (block.StereoBand > block.BandCount) {
            throw new InvalidDataException();
        }

        block.bandExtensionEnabled = reader.readBool();

        if (block.bandExtensionEnabled) {
            block.ExtensionBand = reader.readInt(4);
            block.ExtensionBand += minBandCount;

            if (block.ExtensionBand < block.BandCount || block.ExtensionBand > maxExtensionBand) {
                throw new InvalidDataException();
            }

            block.ExtensionUnit = Tables.BandToQuantUnitCount[block.ExtensionBand];
        } else {
            block.ExtensionBand = block.BandCount;
            block.ExtensionUnit = block.QuantizationUnitCount;
        }
    }

    static readGradientParams(reader: BitReader, block: Block) {
        block.GradientMode = reader.readInt(2);

        if (block.GradientMode > 0) {
            block.GradientEndUnit = 31;
            block.GradientEndValue = 31;
            block.GradientStartUnit = reader.readInt(5);
            block.GradientStartValue = reader.readInt(5);
        } else {
            block.GradientStartUnit = reader.readInt(6);
            block.GradientEndUnit = reader.readInt(6) + 1;
            block.GradientStartValue = reader.readInt(5);
            block.GradientEndValue = reader.readInt(5);
        }

        block.GradientBoundary = reader.readInt(4);

        if (block.GradientBoundary > block.QuantizationUnitCount) {
            throw new InvalidDataException();
        }

        if (block.GradientStartUnit < 1 || block.GradientStartUnit >= 48) {
            throw new InvalidDataException();
        }

        if (block.GradientEndUnit < 1 || block.GradientEndUnit >= 48) {
            throw new InvalidDataException();
        }

        if (block.GradientStartUnit > block.GradientEndUnit) {
            throw new InvalidDataException();
        }

        if (block.GradientStartValue < 0 || block.GradientStartValue >= 32) {
            throw new InvalidDataException();
        }

        if (block.GradientEndValue < 0 || block.GradientEndValue >= 32) {
            throw new InvalidDataException();
        }
    }

    static readStereoParams(reader: BitReader, block: Block) {
        if (block.BlockType !== BlockType.Stereo) {
            return;
        }

        block.PrimaryChannelIndex = reader.readInt(1);
        block.HasJointStereoSigns = reader.readBool();

        if (block.HasJointStereoSigns) {
            for (let i = block.StereoQuantizationUnit; i < block.QuantizationUnitCount; i++) {
                block.JointStereoSigns[i] = reader.readInt(1);
            }
        } else {
            block.JointStereoSigns.fill(0);
        }
    }

    static readExtensionParams(reader: BitReader, block: Block) {
        function readHeader(channel: Channel) {
            const bexMode = reader.readInt(2);
            channel.BexMode = bexBand > 2 ? bexMode : 4;
            channel.BexValueCount = Tables.BexEncodedValueCounts[channel.BexMode][bexBand];
        }

        function readData(channel: Channel) {
            for (let i = 0; i < channel.BexValueCount; i++) {
                const dataLength = Tables.BexDataLengths[channel.BexMode][bexBand][i];
                channel.BexValues[i] = reader.readInt(dataLength);
            }
        }
        
        let bexBand = 0;

        if (block.bandExtensionEnabled) {
            bexBand = BandExtension.getBexBandInfo(block.QuantizationUnitCount)[0];

            if (block.BlockType === BlockType.Stereo) {
                readHeader(block.Channels[1]);
            } else {
                reader.position += 1;
            }
        }

        block.hasExtensionData = reader.readBool();

        if (!block.hasExtensionData) {
            return;
        }

        if (!block.bandExtensionEnabled) {
            block.bexMode = reader.readInt(2);
            block.bexDataLength = reader.readInt(5);
            reader.position += block.bexDataLength;
            return;
        }

        readHeader(block.Channels[0]);

        block.bexDataLength = reader.readInt(5);

        if (block.bexDataLength <= 0) {
            return;
        }

        const bexDataEnd = reader.position + block.bexDataLength;

        readData(block.Channels[0]);

        if (block.BlockType === BlockType.Stereo) {
            readData(block.Channels[1]);
        }

        if (reader.position > bexDataEnd) {
            throw new InvalidDataException();
        }
    }

    static calculateSpectrumCodebookIndex(channel: Channel) {
        channel.CodebookSet.fill(0);
        const quantUnits = channel.CodedQuantUnits;
        const sf = channel.ScaleFactors;

        if (quantUnits <= 1) {
            return;
        }

        if (channel.Config.HighSampleRate) {
            return;
        }

        const originalScaleTmp = sf[quantUnits];
        sf[quantUnits] = sf[quantUnits - 1];

        let avg = 0;

        if (quantUnits > 12) {
            for (let i = 0; i < 12; i++) {
                avg += sf[i];
            }
            avg = Math.floor((avg + 6) / 12);
        }

        for (let i = 8; i < quantUnits; i++) {
            const prevSf = sf[i - 1];
            const nextSf = sf[i + 1];
            const minSf = Math.min(prevSf, nextSf);

            if (sf[i] - minSf >= 3 || sf[i] - prevSf + sf[i] - nextSf >= 3) {
                channel.CodebookSet[i] = 1;
            }
        }

        for (let i = 12; i < quantUnits; i++) {
            if (channel.CodebookSet[i] === 0) {
                const minSf = Math.min(sf[i - 1], sf[i + 1]);

                if (sf[i] - minSf >= 2 && sf[i] >= avg - (Tables.QuantUnitToCoeffCount[i] === 16 ? 1 : 0)) {
                    channel.CodebookSet[i] = 1;
                }
            }
        }

        sf[quantUnits] = originalScaleTmp;
    }

    static readSpectra(reader: BitReader, channel: Channel) {
        const values = channel.SpectraValuesBuffer;
        channel.QuantizedSpectra.fill(0);
        const maxHuffPrecision = Tables.MaxHuffPrecision(channel.Config.HighSampleRate);

        for (let i = 0; i < channel.CodedQuantUnits; i++) {
            const subbandCount = Tables.QuantUnitToCoeffCount[i];
            const precision = channel.Precisions[i] + 1;

            if (precision <= maxHuffPrecision) {
                const huff = Tables.HuffmanSpectrum[channel.CodebookSet[i]][precision][Tables.QuantUnitToCodebookIndex[i]];
                const groupCount = subbandCount >> huff.ValueCountPower;

                for (let j = 0; j < groupCount; j++) {
                    values[j] = Unpack.readHuffmanValue(huff, reader);
                }

                Unpack.decodeHuffmanValues(channel.QuantizedSpectra, Tables.QuantUnitToCoeffIndex[i], subbandCount, huff, values);
            } else {
                const subbandIndex = Tables.QuantUnitToCoeffIndex[i];

                for (let j = subbandIndex; j < Tables.QuantUnitToCoeffIndex[i + 1]; j++) {
                    channel.QuantizedSpectra[j] = reader.readSignedInt(precision);
                }
            }
        }
    }

    static readSpectraFine(reader: BitReader, channel: Channel) {
        channel.QuantizedSpectraFine.fill(0)

        for (let i = 0; i < channel.CodedQuantUnits; i++) {
            if (channel.PrecisionsFine[i] > 0) {
                const overflowBits = channel.PrecisionsFine[i] + 1;
                const startSubband = Tables.QuantUnitToCoeffIndex[i];
                const endSubband = Tables.QuantUnitToCoeffIndex[i + 1];

                for (let j = startSubband; j < endSubband; j++) {
                    channel.QuantizedSpectraFine[j] = reader.readSignedInt(overflowBits);
                }
            }
        }
    }

    static decodeHuffmanValues(spectrum: Int32Array, index: number, bandCount: number, huff: HuffmanCodebook, values: Int32Array) {
        const valueCount = bandCount >> huff.ValueCountPower;
        const mask = (1 << huff.ValueBits) - 1;

        for (let i = 0; i < valueCount; i++) {
            let value = values[i];

            for (let j = 0; j < huff.ValueCount; j++) {
                spectrum[index++] = Bit.signExtend32(value & mask, huff.ValueBits);
                value >>= huff.ValueBits;
            }
        }
    }

    static readHuffmanValue(huff: HuffmanCodebook, reader: BitReader, signed = false) {
        const code = reader.peekInt(huff.MaxBitSize);
        const value = huff.Lookup[code];
        const bits = huff.Bits[value];

        reader.position += bits;

        return signed ? Bit.signExtend32(value, huff.ValueBits) : value;
    }

    static unpackLfeBlock(reader: BitReader, block: Block) {
        const channel = block.Channels[0];
        block.QuantizationUnitCount = 2;

        Unpack.decodeLfeScaleFactors(reader, channel);
        Unpack.calculateLfePrecision(channel);
        channel.CodedQuantUnits = block.QuantizationUnitCount;
        Unpack.readLfeSpectra(reader, channel);
    }

    static decodeLfeScaleFactors(reader: BitReader, channel: Channel) {
        channel.ScaleFactors.fill(0);

        for (let i = 0; i < channel.Block.QuantizationUnitCount; i++) {
            channel.ScaleFactors[i] = reader.readInt(5);
        }
    }

    static calculateLfePrecision(channel: Channel) {
        const block = channel.Block;
        const precision = block.ReuseBandParams ? 8 : 4;

        for (let i = 0; i < block.QuantizationUnitCount; i++) {
            channel.Precisions[i] = precision;
            channel.PrecisionsFine[i] = 0;
        }
    }

    static readLfeSpectra(reader: BitReader, channel: Channel) {
        channel.QuantizedSpectra.fill(0);

        for (let i = 0; i < channel.CodedQuantUnits; i++) {
            if (channel.Precisions[i] <= 0) {
                continue;
            }

            const precision = channel.Precisions[i] + 1;

            for (let j = Tables.QuantUnitToCoeffIndex[i]; j < Tables.QuantUnitToCoeffIndex[i + 1]; j++) {
                channel.QuantizedSpectra[j] = reader.readSignedInt(precision);
            }
        }
    }
}