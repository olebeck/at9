var At9 = (function () {
    'use strict';

    class MediaSubtypes {
        static parseGuid(bytes) {
            if (!(bytes instanceof Uint8Array) || bytes.length !== 16) {
                throw new Error('Invalid byte array for GUID');
            }
            const hexArray = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));
            // Insert hyphens at the correct positions to match GUID format
            const guidString = `${hexArray.slice(0, 4).join('')}-${hexArray.slice(4, 6).join('')}-${hexArray.slice(6, 8).join('')}-${hexArray.slice(8, 10).join('')}-${hexArray.slice(10).join('')}`;
            return guidString;
        }
    }
    MediaSubtypes.mediaSubtypePcm = new Uint8Array([1, 0, 0, 0, 0, 0, 16, 0, 128, 0, 0, 170, 0, 56, 57, 183, 113]);
    MediaSubtypes.mediaSubtypeAtrac9 = new Uint8Array([210, 66, 225, 71, 186, 54, 141, 77, 136, 252, 97, 101, 79, 140, 131, 108]);
    const WaveFormatTags = {
        WaveFormatPcm: 0x0001,
        WaveFormatExtensible: 0xFFFE,
    };

    class BinaryReader {
        constructor(arrayBuffer) {
            this.dataView = new DataView(arrayBuffer);
            this.position = 0;
            this.length = arrayBuffer.byteLength;
        }
        readUTF8(length) {
            const bytes = new Uint8Array(this.dataView.buffer, this.position, length);
            this.position += length;
            return new TextDecoder('utf-8').decode(bytes);
        }
        readUInt8() {
            const value = this.dataView.getUint8(this.position);
            this.position += 1;
            return value;
        }
        readUInt16() {
            const value = this.dataView.getUint16(this.position, true);
            this.position += 2;
            return value;
        }
        readInt16() {
            const value = this.dataView.getInt16(this.position, true);
            this.position += 2;
            return value;
        }
        readUInt32() {
            const value = this.dataView.getUint32(this.position, true); // true for little-endian
            this.position += 4;
            return value;
        }
        readInt32() {
            const value = this.dataView.getInt32(this.position, true); // true for little-endian
            this.position += 4;
            return value;
        }
        readBytes(length) {
            const bytes = new Uint8Array(this.dataView.buffer, this.position, length);
            this.position += length;
            return bytes;
        }
        deInterleave(length, interleaveSize, outputCount, outputSize = -1) {
            if (length % outputCount !== 0) {
                throw new Error(`The input length (${length}) must be divisible by the number of outputs.`);
            }
            const inputSize = length / outputCount;
            if (outputSize === -1) {
                outputSize = inputSize;
            }
            const inBlockCount = Math.ceil(inputSize / interleaveSize);
            const outBlockCount = Math.ceil(outputSize / interleaveSize);
            const lastInputInterleaveSize = inputSize - (inBlockCount - 1) * interleaveSize;
            const lastOutputInterleaveSize = outputSize - (outBlockCount - 1) * interleaveSize;
            const blocksToCopy = Math.min(inBlockCount, outBlockCount);
            const outputs = Array.from({ length: outputCount }, () => new Uint8Array(outputSize));
            for (let b = 0; b < blocksToCopy; b++) {
                const currentInputInterleaveSize = b === inBlockCount - 1 ? lastInputInterleaveSize : interleaveSize;
                const currentOutputInterleaveSize = b === outBlockCount - 1 ? lastOutputInterleaveSize : interleaveSize;
                const bytesToCopy = Math.min(currentInputInterleaveSize, currentOutputInterleaveSize);
                for (let o = 0; o < outputCount; o++) {
                    const chunk = this.readBytes(bytesToCopy);
                    outputs[o].set(chunk, interleaveSize * b);
                    if (bytesToCopy < currentInputInterleaveSize) {
                        // Skip the remaining bytes in the input interleave block
                        this.position += currentInputInterleaveSize - bytesToCopy;
                    }
                }
            }
            return outputs;
        }
    }

    class RiffChunk {
        constructor() {
            this.ChunkId = "";
            this.Size = 0;
            this.Type = "";
        }
        static Parse(reader) {
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

    class RiffSubChunk {
        constructor(reader) {
            this.SubChunkId = reader.readUTF8(4);
            this.SubChunkSize = reader.readInt32();
            this.Extra = null; // You may read the extra data here if needed
        }
    }

    class WaveDataChunk extends RiffSubChunk {
        constructor(parser, reader) {
            super(reader);
            if (parser.ReadDataChunk) {
                this.Data = reader.readBytes(this.SubChunkSize);
            }
        }
        static Parse(parser, reader) {
            return new WaveDataChunk(parser, reader);
        }
    }

    class WaveFactChunk extends RiffSubChunk {
        constructor(reader) {
            super(reader);
            this.SampleCount = reader.readInt32();
        }
        static Parse(parser, reader) {
            return new WaveFactChunk(reader);
        }
    }

    class WaveFmtChunk extends RiffSubChunk {
        constructor(parser, reader) {
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
                if (this.Ext) {
                    const endOffset = startOffset + this.Ext.Size;
                    const remainingBytes = Math.max(endOffset - reader.position, 0);
                    this.Ext.Extra = reader.readBytes(remainingBytes);
                }
            }
        }
        static Parse(parser, reader) {
            return new WaveFmtChunk(parser, reader);
        }
    }

    class UUID {
        constructor(bytes) {
            if (bytes.length !== 16) {
                throw new Error('UUID must be initialized with 16 bytes');
            }
            this.bytes = bytes;
        }
        toString() {
            const hexArray = Array.from(this.bytes, byte => byte.toString(16).padStart(2, '0'));
            return `${hexArray.slice(0, 4).join('')}-${hexArray.slice(4, 6).join('')}-${hexArray.slice(6, 8).join('')}-${hexArray.slice(8, 10).join('')}-${hexArray.slice(10).join('')}`;
        }
    }

    class WaveFormatExtensible {
        constructor(reader) {
            this.Size = reader.readInt16();
            this.ValidBitsPerSample = reader.readInt16();
            this.SamplesPerBlock = this.ValidBitsPerSample;
            this.ChannelMask = reader.readUInt32();
            this.SubFormat = new UUID(reader.readBytes(16));
            this.Extra = null;
        }
        static Parse(parser, reader) {
            return new WaveFormatExtensible(reader);
        }
    }

    class WaveSmplChunk extends RiffSubChunk {
        constructor(reader) {
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
        static Parse(parser, reader) {
            return new WaveSmplChunk(reader);
        }
    }

    class RiffParser {
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
        RegisterSubChunk(id, subChunkReader) {
            if (id.length !== 4) {
                throw new Error("Subchunk ID must be 4 characters long");
            }
            this.RegisteredSubChunks[id] = subChunkReader;
        }
        ParseRiff(file) {
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
        GetSubChunk(id) {
            return this.SubChunks[id];
        }
        ParseSubChunk(reader) {
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

    class AudioReader {
        constructor() {
            this.TConfig = null;
            if (this.constructor === AudioReader) {
                throw new Error('Cannot instantiate abstract class AudioReader.');
            }
        }
        readFormat(stream) {
            return this.readStream(stream).audioFormat;
        }
        readFormatFromArray(file) {
            return this.readByteArray(file).audioFormat;
        }
        read(stream) {
            return this.readStream(stream).audio;
        }
        readFromArray(file) {
            return this.readByteArray(file).audio;
        }
        readWithConfig(stream) {
            return this.readStream(stream);
        }
        readWithConfigFromArray(file) {
            return this.readByteArray(file);
        }
        readMetadata(stream) {
            const structure = this.readFile(stream, false);
            return this.getConfiguration(structure);
        }
        getConfiguration(structure) {
            return new this.TConfig();
        }
        readFile(stream, readAudioData = true) {
            throw new Error('Method "readFile" must be implemented in derived classes.');
        }
        toAudioStream(structure) {
            throw new Error('Method "toAudioStream" must be implemented in derived classes.');
        }
        readByteArray(file) {
            const stream = new Uint8Array(file).buffer;
            return this.readStream(stream);
        }
        readStream(stream) {
            const structure = this.readFile(stream);
            const audioStream = this.toAudioStream(structure);
            this.getConfiguration(structure);
            return { audio: audioStream, audioFormat: audioStream };
        }
    }

    class At9Configuration {
    }

    class At9FactChunk extends WaveFactChunk {
        constructor(reader) {
            super(reader);
            this.InputOverlapDelaySamples = reader.readInt32();
            this.EncoderDelaySamples = reader.readInt32();
        }
        static parseAt9(parser, reader) {
            return new At9FactChunk(reader);
        }
    }

    class At9WaveExtensible extends WaveFormatExtensible {
        constructor(reader) {
            super(reader);
            this.VersionInfo = reader.readInt32();
            this.ConfigData = reader.readBytes(4);
            this.Reserved = reader.readInt32();
        }
        static parseAt9(parser, reader) {
            return new At9WaveExtensible(reader);
        }
    }

    class Bit {
        static bitReverse32(value) {
            value = ((value & 0xaaaaaaaa) >>> 1) | ((value & 0x55555555) << 1);
            value = ((value & 0xcccccccc) >>> 2) | ((value & 0x33333333) << 2);
            value = ((value & 0xf0f0f0f0) >>> 4) | ((value & 0x0f0f0f0f) << 4);
            value = ((value & 0xff00ff00) >>> 8) | ((value & 0x00ff00ff) << 8);
            return (value >>> 16) | (value << 16) >>> 0; // Ensure the result is an unsigned 32-bit integer
        }
        static bitReverse32WithBitCount(value, bitCount) {
            return Bit.bitReverse32(value) >>> (32 - bitCount);
        }
        static bitReverse8(value) {
            return ((value * 0x80200802) & 0x0884422110) * 0x0101010101 >> 32;
        }
        static signExtend32(value, bits) {
            const shift = 8 * 4 - bits; // Assuming 32-bit integers
            return (value << shift) >> shift;
        }
    }

    class BitReader {
        constructor(buffer) {
            this.buffer = null;
            this.lengthBits = 0;
            this.position = 0;
            this.setBuffer(buffer);
        }
        setBuffer(buffer) {
            this.buffer = buffer;
            this.lengthBits = this.buffer ? this.buffer.length * 8 : 0;
            this.position = 0;
        }
        get remaining() {
            return this.lengthBits - this.position;
        }
        readInt(bitCount) {
            const value = this.peekInt(bitCount);
            this.position += bitCount;
            return value;
        }
        readSignedInt(bitCount) {
            const value = this.peekInt(bitCount);
            this.position += bitCount;
            return Bit.signExtend32(value, bitCount);
        }
        readBool() {
            return this.readInt(1) === 1;
        }
        readOffsetBinary(bitCount, bias) {
            const offset = (1 << (bitCount - 1)) - bias;
            const value = this.peekInt(bitCount) - offset;
            this.position += bitCount;
            return value;
        }
        alignPosition(multiple) {
            this.position = Math.ceil(this.position / multiple) * multiple;
        }
        peekInt(bitCount) {
            if (!this.buffer)
                return 0;
            if (bitCount > this.remaining) {
                if (this.position >= this.lengthBits)
                    return 0;
                const extraBits = bitCount - this.remaining;
                return this.peekIntFallback(this.remaining) << extraBits;
            }
            const byteIndex = Math.floor(this.position / 8);
            const bitIndex = this.position % 8;
            if (bitCount <= 9 && this.remaining >= 16) {
                let value = (this.buffer[byteIndex] << 8) | this.buffer[byteIndex + 1];
                value &= 0xFFFF >> bitIndex;
                value >>= 16 - bitCount - bitIndex;
                return value;
            }
            if (bitCount <= 17 && this.remaining >= 24) {
                let value = (this.buffer[byteIndex] << 16) | (this.buffer[byteIndex + 1] << 8) | this.buffer[byteIndex + 2];
                value &= 0xFFFFFF >> bitIndex;
                value >>= 24 - bitCount - bitIndex;
                return value;
            }
            if (bitCount <= 25 && this.remaining >= 32) {
                let value = (this.buffer[byteIndex] << 24) | (this.buffer[byteIndex + 1] << 16) | (this.buffer[byteIndex + 2] << 8) | this.buffer[byteIndex + 3];
                value &= (0xFFFFFFFF >> bitIndex);
                value >>= 32 - bitCount - bitIndex;
                return value;
            }
            return this.peekIntFallback(bitCount);
        }
        peekIntFallback(bitCount) {
            if (!this.buffer)
                return 0;
            let value = 0;
            let byteIndex = Math.floor(this.position / 8);
            let bitIndex = this.position % 8;
            while (bitCount > 0) {
                if (bitIndex >= 8) {
                    bitIndex = 0;
                    byteIndex++;
                }
                const bitsToRead = Math.min(bitCount, 8 - bitIndex);
                const mask = 0xFF >> bitIndex;
                const currentByte = (mask & this.buffer[byteIndex]) >> (8 - bitIndex - bitsToRead);
                value = (value << bitsToRead) | currentByte;
                bitIndex += bitsToRead;
                bitCount -= bitsToRead;
            }
            return value;
        }
    }
    BitReader.OffsetBias = {
        Positive: 1,
        Negative: 0,
    };

    class ArrayUnpacker {
        static GetHighNibble(value) { return ((value >> 4) & 0xF) & 0xff; }
        static GetLowNibble(value) { return (value & 0xF) & 0xff; }
        static async UnpackArrays(packedArrays) {
            packedArrays = await this.TryDecompress(packedArrays);
            const reader = new BinaryReader(packedArrays.buffer);
            const compressed = reader.readUInt8();
            const version = reader.readUInt8();
            if (compressed !== 0 || version !== 0)
                throw new Error('Invalid data');
            const count = reader.readUInt16();
            const arrays = new Array(count);
            for (let i = 0; i < count; i++) {
                const id = reader.readUInt8();
                const type = reader.readUInt8();
                const outType = this.TypeLookup[ArrayUnpacker.GetHighNibble(type)];
                const rank = ArrayUnpacker.GetLowNibble(type);
                arrays[id] = this.UnpackArray(reader, outType, rank);
            }
            return arrays;
        }
        static UnpackArray(reader, outType, rank) {
            const modeType = reader.readUInt8();
            if (modeType === 0xFF)
                return null;
            const mode = ArrayUnpacker.GetHighNibble(modeType);
            const storedType = this.TypeLookup[ArrayUnpacker.GetLowNibble(modeType)];
            switch (mode) {
                case 0: {
                    const length = reader.readUInt16();
                    if (rank === 1) {
                        return this.ReadArray(reader, storedType, outType, length);
                    }
                    const array = Array(length);
                    for (let i = 0; i < length; i++) {
                        array[i] = this.UnpackArray(reader, outType, rank - 1);
                    }
                    return array;
                }
                case 1: {
                    const dimensions = new Array(rank);
                    for (let d = 0; d < dimensions.length; d++) {
                        dimensions[d] = reader.readUInt16();
                    }
                    return this.UnpackInternal(outType, storedType, reader, 0, dimensions);
                }
                case 2: {
                    const length = reader.readUInt16();
                    const lengths = new Array(length);
                    for (let i = 0; i < length; i++) {
                        lengths[i] = reader.readUInt16();
                    }
                    const array = Array(length);
                    for (let i = 0; i < length; i++) {
                        array[i] = this.ReadArray(reader, storedType, outType, lengths[i]);
                    }
                    return array;
                }
                default:
                    throw new Error('Invalid data');
            }
        }
        static ReadArray(reader, storedType, outType, length) {
            if (length === 0xFFFF)
                return null;
            function copy(src) {
                var dst = new ArrayBuffer(src.byteLength);
                new Uint8Array(dst).set(src);
                return dst;
            }
            const lengthBytes = length * storedType.BYTES_PER_ELEMENT;
            const array = new storedType(copy(reader.readBytes(lengthBytes)));
            if (storedType == outType)
                return array;
            const array2 = new outType(array.length);
            for (let i = 0; i < array.length; i++) {
                array2[i] = array[i];
            }
            return array2;
        }
        static async TryDecompress(data) {
            const compressed = data[0] === 1;
            if (compressed) {
                const decompressedLength = new DataView(data.buffer, 1, 4).getInt32(0, true);
                data = await this.inflateAsync(data, 5, decompressedLength);
            }
            return data;
        }
        static async inflateAsync(compressed, startIndex, length) {
            const compressedData = compressed.subarray(startIndex, startIndex + length);
            try {
                const decompressionStream = new DecompressionStream('deflate-raw');
                const readableStream = new ReadableStream({
                    start(controller) {
                        controller.enqueue(compressedData);
                        controller.close();
                    }
                });
                const inflationStream = readableStream.pipeThrough(decompressionStream);
                const reader = inflationStream.getReader();
                const resultChunks = [];
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    resultChunks.push(value);
                }
                const out = new Uint8Array(resultChunks.map(r => r.byteLength).reduce((p, c) => p + c));
                let o = 0;
                resultChunks.forEach(r => {
                    out.set(r, o);
                    o += r.byteLength;
                });
                return out;
            }
            catch (error) {
                throw new Error(`Inflation error: ${error.message}`);
            }
        }
        static UnpackInternal(outType, storedType, reader, depth, dimensions) {
            if (depth >= dimensions.length)
                return null;
            if (depth === dimensions.length - 1) {
                return this.ReadArray(reader, storedType, outType, dimensions[depth]);
            }
            const array = new Array(dimensions[depth]);
            for (let i = 0; i < dimensions[depth]; i++) {
                array[i] = this.UnpackInternal(outType, storedType, reader, depth + 1, dimensions);
            }
            return array;
        }
    }
    ArrayUnpacker.TypeLookup = [
        Uint8Array, Int8Array, Uint8Array,
        Int16Array, Uint16Array,
        Int32Array, Uint32Array,
        BigInt64Array, BigUint64Array,
        Float32Array, Float64Array,
    ];

    class BitAllocation {
        static createGradient(block) {
            const valueCount = block.GradientEndValue - block.GradientStartValue;
            const unitCount = block.GradientEndUnit - block.GradientStartUnit;
            for (let i = 0; i < block.GradientEndUnit; i++) {
                block.Gradient[i] = block.GradientStartValue;
            }
            for (let i = block.GradientEndUnit; i <= block.QuantizationUnitCount; i++) {
                block.Gradient[i] = block.GradientEndValue;
            }
            if (unitCount <= 0 || valueCount == 0) {
                return;
            }
            const curve = Tables$1.GradientCurves[unitCount - 1];
            if (valueCount <= 0) {
                const scale = (-valueCount - 1) / 31.0;
                const baseVal = block.GradientStartValue - 1;
                for (let i = block.GradientStartUnit; i < block.GradientEndUnit; i++) {
                    block.Gradient[i] = baseVal - Math.floor(curve[i - block.GradientStartUnit] * scale);
                }
            }
            else {
                const scale = (valueCount - 1) / 31.0;
                const baseVal = block.GradientStartValue + 1;
                for (let i = block.GradientStartUnit; i < block.GradientEndUnit; i++) {
                    block.Gradient[i] = baseVal + Math.floor(curve[i - block.GradientStartUnit] * scale);
                }
            }
        }
        static calculateMask(channel) {
            channel.PrecisionMask.fill(0);
            for (let i = 1; i < channel.Block.QuantizationUnitCount; i++) {
                const delta = channel.ScaleFactors[i] - channel.ScaleFactors[i - 1];
                if (delta > 1) {
                    channel.PrecisionMask[i] += Math.min(delta - 1, 5);
                }
                else if (delta < -1) {
                    channel.PrecisionMask[i - 1] += Math.min(delta * -1 - 1, 5);
                }
            }
        }
        static calculatePrecisions(channel) {
            const block = channel.Block;
            if (block.GradientMode !== 0) {
                for (let i = 0; i < block.QuantizationUnitCount; i++) {
                    channel.Precisions[i] = channel.ScaleFactors[i] + channel.PrecisionMask[i] - block.Gradient[i];
                    if (channel.Precisions[i] > 0) {
                        switch (block.GradientMode) {
                            case 1:
                                channel.Precisions[i] /= 2;
                                break;
                            case 2:
                                channel.Precisions[i] = 3 * channel.Precisions[i] / 8;
                                break;
                            case 3:
                                channel.Precisions[i] /= 4;
                                break;
                        }
                    }
                }
            }
            else {
                for (let i = 0; i < block.QuantizationUnitCount; i++) {
                    channel.Precisions[i] = channel.ScaleFactors[i] - block.Gradient[i];
                }
            }
            for (let i = 0; i < block.QuantizationUnitCount; i++) {
                if (channel.Precisions[i] < 1) {
                    channel.Precisions[i] = 1;
                }
            }
            for (let i = 0; i < block.GradientBoundary; i++) {
                channel.Precisions[i]++;
            }
            for (let i = 0; i < block.QuantizationUnitCount; i++) {
                channel.PrecisionsFine[i] = 0;
                if (channel.Precisions[i] > 15) {
                    channel.PrecisionsFine[i] = channel.Precisions[i] - 15;
                    channel.Precisions[i] = 15;
                }
            }
        }
        static GenerateGradientCurves() {
            const main = [
                1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 4, 5, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15,
                16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 26, 27, 27, 28, 28, 28, 29, 29, 29, 29, 30, 30, 30, 30
            ];
            const curves = new Array(main.length);
            for (let length = 1; length <= main.length; length++) {
                curves[length - 1] = new Array(length);
                for (let i = 0; i < length; i++) {
                    curves[length - 1][i] = main[Math.floor((i * main.length) / length)];
                }
            }
            return curves;
        }
    }

    var BlockType;
    (function (BlockType) {
        BlockType[BlockType["Mono"] = 0] = "Mono";
        BlockType[BlockType["Stereo"] = 1] = "Stereo";
        BlockType[BlockType["LFE"] = 2] = "LFE";
    })(BlockType || (BlockType = {}));

    class ChannelConfig {
        constructor(...blockTypes) {
            this.BlockCount = blockTypes.length;
            this.BlockTypes = blockTypes;
            this.ChannelCount = blockTypes.reduce((count, type) => count + this.blockTypeToChannelCount(type), 0);
        }
        blockTypeToChannelCount(blockType) {
            switch (blockType) {
                case BlockType.Mono:
                    return 1;
                case BlockType.Stereo:
                    return 2;
                case BlockType.LFE:
                    return 1;
                default:
                    return 0;
            }
        }
    }

    class Helpers {
        static createJaggedArray(type, ...lengths) {
            return this.initializeJaggedArray(type, 0, lengths);
        }
        static initializeJaggedArray(type, index, lengths) {
            if (index == lengths.length - 1) {
                return new type(lengths[index]);
            }
            else {
                const array = new Array(lengths[index]);
                for (let i = 0; i < lengths[index]; i++) {
                    array[i] = this.initializeJaggedArray(type, index + 1, lengths);
                }
                return array;
            }
        }
        static Clamp16(value) {
            if (value > 32767)
                return 32767;
            if (value < -32768)
                return -32768;
            return value;
        }
        static Clamp(value, min, max) {
            if (value < min)
                return min;
            if (value > max)
                return max;
            return value;
        }
        static base64ToUint8Array(base64String) {
            const binaryString = atob(base64String);
            const uint8Array = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                uint8Array[i] = binaryString.charCodeAt(i);
            }
            return uint8Array;
        }
    }

    class HuffmanCodebook {
        constructor(codes, bits, valueCountPower) {
            this.Codes = codes;
            this.Bits = bits;
            if (this.Codes === null || this.Bits === null) {
                throw new Error("Codes or Bits is null");
            }
            this.ValueCount = 1 << valueCountPower;
            this.ValueCountPower = valueCountPower;
            this.ValueBits = Math.log2(this.Codes.length) >> valueCountPower;
            this.ValueMax = 1 << this.ValueBits;
            let max = 0;
            for (const bitSize of this.Bits) {
                max = Math.max(max, bitSize);
            }
            this.MaxBitSize = max;
            this.Lookup = this.createLookupTable();
        }
        createLookupTable() {
            const tableSize = 1 << this.MaxBitSize;
            const dest = new Array(tableSize).fill(0);
            for (let i = 0; i < this.Bits.length; i++) {
                if (this.Bits[i] === 0)
                    continue;
                const unusedBits = this.MaxBitSize - this.Bits[i];
                const start = this.Codes[i] << unusedBits;
                const length = 1 << unusedBits;
                const end = start + length;
                for (let j = start; j < end; j++) {
                    dest[j] = i;
                }
            }
            return dest;
        }
    }

    class PackedTables {
        static GenerateHuffmanCodebooks3(codes, bits, groupCounts) {
            const tables = new Array(bits.length);
            for (let i = 0; i < bits.length; i++) {
                if (codes[i] != null) {
                    tables[i] = PackedTables.GenerateHuffmanCodebooks2(codes[i], bits[i], groupCounts[i]);
                }
            }
            return tables;
        }
        static GenerateHuffmanCodebooks2(codes, bits, groupCounts) {
            const tables = new Array(bits.length);
            for (let i = 0; i < bits.length; i++) {
                if (codes[i] != null) {
                    tables[i] = new HuffmanCodebook(codes[i], bits[i], groupCounts[i]);
                }
            }
            return tables;
        }
    }
    PackedTables.Tables = Helpers.base64ToUint8Array("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");

    var _a;
    function SpectrumScaleFunction(x) {
        return Math.pow(2, x - 15);
    }
    function QuantizerStepSizeFunction(x) {
        return 2.0 / ((1 << (x + 1)) - 1);
    }
    function QuantizerInverseStepSizeFunction(x) {
        return 1 / QuantizerStepSizeFunction(x);
    }
    function QuantizerFineStepSizeFunction(x) {
        return QuantizerStepSizeFunction(x) / 65535;
    }
    class Tables {
        static MaxHuffPrecision(highSampleRate) { return highSampleRate ? 1 : 7; }
        static MinBandCount(highSampleRate) { return highSampleRate ? 1 : 3; }
        static MaxExtensionBand(highSampleRate) { return highSampleRate ? 16 : 18; }
        static GenerateImdctWindow(frameSizePower) {
            const frameSize = 1 << frameSizePower;
            const output = new Float64Array(frameSize);
            const a1 = this.GenerateMdctWindow(frameSizePower);
            for (let i = 0; i < frameSize; i++) {
                output[i] = a1[i] / (a1[frameSize - 1 - i] * a1[frameSize - 1 - i] + a1[i] * a1[i]);
            }
            return output;
        }
        static GenerateMdctWindow(frameSizePower) {
            const frameSize = 1 << frameSizePower;
            const output = new Float64Array(frameSize);
            for (let i = 0; i < frameSize; i++) {
                output[i] = (Math.sin(((i + 0.5) / frameSize - 0.5) * Math.PI) + 1.0) * 0.5;
            }
            return output;
        }
    }
    _a = Tables;
    Tables.SampleRates = [
        11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000,
        44100, 48000, 64000, 88200, 96000, 128000, 176400, 192000
    ];
    Tables.SamplingRateIndexToFrameSamplesPower = [6, 6, 7, 7, 7, 8, 8, 8, 6, 6, 7, 7, 7, 8, 8, 8];
    Tables.MaxBandCount = [8, 8, 12, 12, 12, 18, 18, 18, 8, 8, 12, 12, 12, 16, 16, 16];
    Tables.BandToQuantUnitCount = [0, 4, 8, 10, 12, 13, 14, 15, 16, 18, 20, 21, 22, 23, 24, 25, 26, 28, 30];
    Tables.QuantUnitToCoeffCount = [
        2, 2, 2, 2, 2, 2, 2, 2, 4, 4, 4, 4, 8, 8, 8,
        8, 8, 8, 8, 8, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16
    ];
    Tables.QuantUnitToCoeffIndex = [
        0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56,
        64, 72, 80, 88, 96, 112, 128, 144, 160, 176, 192, 208, 224, 240, 256
    ];
    Tables.QuantUnitToCodebookIndex = [
        0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2,
        2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3
    ];
    Tables.ChannelConfig = [
        new ChannelConfig(BlockType.Mono),
        new ChannelConfig(BlockType.Mono, BlockType.Mono),
        new ChannelConfig(BlockType.Stereo),
        new ChannelConfig(BlockType.Stereo, BlockType.Mono, BlockType.LFE, BlockType.Stereo),
        new ChannelConfig(BlockType.Stereo, BlockType.Mono, BlockType.LFE, BlockType.Stereo, BlockType.Stereo),
        new ChannelConfig(BlockType.Stereo, BlockType.Stereo)
    ];
    Tables.MdctWindow = [_a.GenerateMdctWindow(6), _a.GenerateMdctWindow(7), _a.GenerateMdctWindow(8)];
    Tables.ImdctWindow = [_a.GenerateImdctWindow(6), _a.GenerateImdctWindow(7), _a.GenerateImdctWindow(8)];
    Tables.SpectrumScale = Array.from({ length: 32 }, (_, x) => SpectrumScaleFunction(x));
    Tables.QuantizerStepSize = Array.from({ length: 16 }, (_, x) => QuantizerStepSizeFunction(x));
    Tables.QuantizerInverseStepSize = Array.from({ length: 16 }, (_, x) => QuantizerInverseStepSizeFunction(x));
    Tables.QuantizerFineStepSize = Array.from({ length: 16 }, (_, x) => QuantizerFineStepSizeFunction(x));
    Tables.GradientCurves = BitAllocation.GenerateGradientCurves();
    Tables.Init = (async () => {
        const arrays = await ArrayUnpacker.UnpackArrays(PackedTables.Tables);
        _a.HuffmanSpectrumA = PackedTables.GenerateHuffmanCodebooks3(arrays[4], arrays[0], arrays[6]);
        _a.HuffmanSpectrumB = PackedTables.GenerateHuffmanCodebooks3(arrays[5], arrays[1], arrays[7]);
        _a.HuffmanSpectrum = [_a.HuffmanSpectrumA, _a.HuffmanSpectrumB];
        _a.HuffmanScaleFactorsUnsigned = PackedTables.GenerateHuffmanCodebooks2(arrays[9], arrays[2], arrays[8]);
        _a.HuffmanScaleFactorsSigned = PackedTables.GenerateHuffmanCodebooks2(arrays[10], arrays[3], arrays[8]);
        _a.ScaleFactorWeights = arrays[11];
        _a.BexGroupInfo = arrays[12];
        _a.BexEncodedValueCounts = arrays[13];
        _a.BexDataLengths = arrays[14];
        _a.BexMode0Bands3 = arrays[15];
        _a.BexMode0Bands4 = arrays[16];
        _a.BexMode0Bands5 = arrays[17];
        _a.BexMode2Scale = arrays[18];
        _a.BexMode3Initial = arrays[19];
        _a.BexMode3Rate = arrays[20];
        _a.BexMode4Multiplier = arrays[21];
    })();
    var Tables$1 = Tables;

    class Atrac9Config {
        constructor(configData) {
            if (!configData || configData.length !== 4) {
                throw new Error("Config data must be 4 bytes long");
            }
            {
                const reader = new BitReader(configData);
                const header = reader.readInt(8);
                this.SampleRateIndex = reader.readInt(4);
                this.ChannelConfigIndex = reader.readInt(3);
                const validationBit = reader.readInt(1);
                this.FrameBytes = reader.readInt(11) + 1;
                this.SuperframeIndex = reader.readInt(2);
                if (header !== 0xFE || validationBit !== 0) {
                    throw new Error("ATRAC9 Config Data is invalid");
                }
                this.ConfigData = configData;
            }
            this.FramesPerSuperframe = 1 << this.SuperframeIndex;
            this.SuperframeBytes = this.FrameBytes << this.SuperframeIndex;
            this.ChannelConfig = Tables$1.ChannelConfig[this.ChannelConfigIndex];
            this.ChannelCount = this.ChannelConfig.ChannelCount;
            this.SampleRate = Tables$1.SampleRates[this.SampleRateIndex];
            this.HighSampleRate = this.SampleRateIndex > 7;
            this.FrameSamplesPower = Tables$1.SamplingRateIndexToFrameSamplesPower[this.SampleRateIndex];
            this.FrameSamples = 1 << this.FrameSamplesPower;
            this.SuperframeSamples = this.FrameSamples * this.FramesPerSuperframe;
        }
    }

    class At9DataChunk extends RiffSubChunk {
        constructor(parser, reader) {
            super(reader);
            // Do not trust the BlockAlign field in the fmt chunk to equal the superframe size.
            // Some AT9 files have an invalid number in there.
            // Calculate the size using the ATRAC9 DataConfig instead.
            let ext = parser.GetSubChunk("fmt ");
            if (ext instanceof WaveFmtChunk && ext.Ext instanceof At9WaveExtensible) {
                let fact = parser.GetSubChunk("fact");
                if (!(fact instanceof At9FactChunk)) {
                    throw new Error("fact chunk must come before data chunk");
                }
                let config = new Atrac9Config(ext.Ext.ConfigData);
                this.FrameCount = Math.ceil((fact.SampleCount + fact.EncoderDelaySamples) / config.SuperframeSamples);
                let dataSize = this.FrameCount * config.SuperframeBytes;
                if (dataSize > reader.length - reader.position) {
                    throw new Error("Required AT9 length is greater than the number of bytes remaining in the file.");
                }
                this.AudioData = reader.deInterleave(dataSize, config.SuperframeBytes, this.FrameCount);
            }
            else {
                throw new Error("fmt chunk must come before data chunk");
            }
        }
        static parseAt9(parser, reader) {
            return new At9DataChunk(parser, reader);
        }
    }

    class At9Structure {
        constructor() {
            this.Config = null;
            this.AudioData = [];
            this.SampleCount = 0;
            this.Version = 0;
            this.EncoderDelay = 0;
            this.SuperframeCount = 0;
            this.Looping = false;
            this.LoopStart = 0;
            this.LoopEnd = 0;
        }
    }

    class AudioFormatBaseBuilder {
        constructor() {
            this.ChannelCount = 0;
            this.Looping = false;
            this.LoopStart = null;
            this.LoopEnd = null;
            this.SampleCount = 0;
            this.SampleRate = 0;
            this.AudioTrack = 0;
        }
    }

    class AudioTrack {
        constructor(channelCount, channelLeft, channelRight, panning, volume) {
            this.channelCount = channelCount;
            this.channelLeft = channelLeft;
            this.channelRight = channelRight;
            this.panning = panning;
            this.volume = volume;
            this.surroundPanning = 0;
            this.flags = 0;
        }
        static getDefaultTrackList(channelCount) {
            const trackCount = Math.ceil(channelCount / 2);
            const tracks = [];
            for (let i = 0; i < trackCount; i++) {
                const trackChannelCount = Math.min(channelCount - i * 2, 2);
                tracks.push(new AudioTrack(trackChannelCount, i * 2, trackChannelCount >= 2 ? i * 2 + 1 : 0, 0, 0));
            }
            return tracks;
        }
    }

    class AudioFormatBase {
        constructor(builder) {
            this._tracks = builder.Tracks || [];
            this.SampleRate = builder.SampleRate;
            this.ChannelCount = builder.ChannelCount;
            this.UnalignedSampleCount = builder.SampleCount;
            this.UnalignedLoopStart = builder.LoopStart ?? 0;
            this.UnalignedLoopEnd = builder.LoopEnd ?? 0;
            this.Looping = builder.Looping;
            this.Tracks = this._tracks.length > 0 ? this._tracks : AudioTrack.getDefaultTrackList(this.ChannelCount);
        }
        get SampleCount() { return this.UnalignedSampleCount; }
        ;
        get LoopStart() { return this.UnalignedLoopStart; }
        ;
        get LoopEnd() { return this.UnalignedLoopEnd; }
        ;
    }

    class BandExtension {
        static applyBandExtension(block) {
            if (!block.bandExtensionEnabled || !block.hasExtensionData)
                return;
            for (const channel of block.Channels) {
                BandExtension.applyBandExtensionChannel(channel);
            }
        }
        static applyBandExtensionChannel(channel) {
            const groupAUnit = channel.Block.QuantizationUnitCount;
            const scaleFactors = channel.ScaleFactors;
            const spectra = channel.Spectra;
            const scales = channel.BexScales;
            const values = channel.BexValues;
            const [bandCount, groupBUnit, groupCUnit] = BandExtension.getBexBandInfo(groupAUnit);
            const totalUnits = Math.max(groupCUnit, 22);
            const groupABin = Tables$1.QuantUnitToCoeffIndex[groupAUnit];
            const groupBBin = Tables$1.QuantUnitToCoeffIndex[groupBUnit];
            const groupCBin = Tables$1.QuantUnitToCoeffIndex[groupCUnit];
            const totalBins = Tables$1.QuantUnitToCoeffIndex[totalUnits];
            BandExtension.fillHighFrequencies(spectra, groupABin, groupBBin, groupCBin, totalBins);
            switch (channel.BexMode) {
                case 0:
                    const bexQuantUnits = totalUnits - groupAUnit;
                    switch (bandCount) {
                        case 3:
                            scales[0] = Tables$1.BexMode0Bands3[0][values[0]];
                            scales[1] = Tables$1.BexMode0Bands3[1][values[0]];
                            scales[2] = Tables$1.BexMode0Bands3[2][values[1]];
                            scales[3] = Tables$1.BexMode0Bands3[3][values[2]];
                            scales[4] = Tables$1.BexMode0Bands3[4][values[3]];
                            break;
                        case 4:
                            scales[0] = Tables$1.BexMode0Bands4[0][values[0]];
                            scales[1] = Tables$1.BexMode0Bands4[1][values[0]];
                            scales[2] = Tables$1.BexMode0Bands4[2][values[1]];
                            scales[3] = Tables$1.BexMode0Bands4[3][values[2]];
                            scales[4] = Tables$1.BexMode0Bands4[4][values[3]];
                            break;
                        case 5:
                            scales[0] = Tables$1.BexMode0Bands5[0][values[0]];
                            scales[1] = Tables$1.BexMode0Bands5[1][values[1]];
                            scales[2] = Tables$1.BexMode0Bands5[2][values[1]];
                            break;
                    }
                    scales[bexQuantUnits - 1] = Tables$1.SpectrumScale[scaleFactors[groupAUnit]];
                    BandExtension.addNoiseToSpectrum(channel, Tables$1.QuantUnitToCoeffIndex[totalUnits - 1], Tables$1.QuantUnitToCoeffCount[totalUnits - 1]);
                    BandExtension.scaleBexQuantUnits(spectra, scales, groupAUnit, totalUnits);
                    break;
                case 1:
                    for (let i = groupAUnit; i < totalUnits; i++) {
                        scales[i - groupAUnit] = Tables$1.SpectrumScale[scaleFactors[i]];
                    }
                    BandExtension.addNoiseToSpectrum(channel, groupABin, totalBins - groupABin);
                    BandExtension.scaleBexQuantUnits(spectra, scales, groupAUnit, totalUnits);
                    break;
                case 2:
                    const groupAScale2 = Tables$1.BexMode2Scale[values[0]];
                    const groupBScale2 = Tables$1.BexMode2Scale[values[1]];
                    for (let i = groupABin; i < groupBBin; i++) {
                        spectra[i] *= groupAScale2;
                    }
                    for (let i = groupBBin; i < groupCBin; i++) {
                        spectra[i] *= groupBScale2;
                    }
                    return;
                case 3:
                    const rate = Math.pow(2, Tables$1.BexMode3Rate[values[1]]);
                    let scale = Tables$1.BexMode3Initial[values[0]];
                    for (let i = groupABin; i < totalBins; i++) {
                        scale *= rate;
                        spectra[i] *= scale;
                    }
                    return;
                case 4:
                    const mult = Tables$1.BexMode4Multiplier[values[0]];
                    const groupAScale4 = 0.7079468 * mult;
                    const groupBScale4 = 0.5011902 * mult;
                    const groupCScale4 = 0.3548279 * mult;
                    for (let i = groupABin; i < groupBBin; i++) {
                        spectra[i] *= groupAScale4;
                    }
                    for (let i = groupBBin; i < groupCBin; i++) {
                        spectra[i] *= groupBScale4;
                    }
                    for (let i = groupCBin; i < totalBins; i++) {
                        spectra[i] *= groupCScale4;
                    }
                    return;
            }
        }
        static scaleBexQuantUnits(spectra, scales, startUnit, totalUnits) {
            for (let i = startUnit; i < totalUnits; i++) {
                for (let k = Tables$1.QuantUnitToCoeffIndex[i]; k < Tables$1.QuantUnitToCoeffIndex[i + 1]; k++) {
                    spectra[k] *= scales[i - startUnit];
                }
            }
        }
        static fillHighFrequencies(spectra, groupABin, groupBBin, groupCBin, totalBins) {
            for (let i = 0; i < groupBBin - groupABin; i++) {
                spectra[groupABin + i] = spectra[groupABin - i - 1];
            }
            for (let i = 0; i < groupCBin - groupBBin; i++) {
                spectra[groupBBin + i] = spectra[groupBBin - i - 1];
            }
            for (let i = 0; i < totalBins - groupCBin; i++) {
                spectra[groupCBin + i] = spectra[groupCBin - i - 1];
            }
        }
        static addNoiseToSpectrum(channel, index, count) {
            if (!channel.Rng) {
                const sf = channel.ScaleFactors;
                const seed = 543 * (sf[8] + sf[12] + sf[15] + 1);
                channel.Rng = new Atrac9Rng(seed);
            }
            for (let i = 0; i < count; i++) {
                channel.Spectra[i + index] = channel.Rng.next() / 65535.0 * 2.0 - 1.0;
            }
        }
        static getBexBandInfo(quantUnits) {
            const groupAUnit = Tables$1.BexGroupInfo[quantUnits - 13][0];
            const groupBUnit = Tables$1.BexGroupInfo[quantUnits - 13][1];
            const bandCount = Tables$1.BexGroupInfo[quantUnits - 13][2];
            return [bandCount, groupAUnit, groupBUnit];
        }
    }

    class Mdct {
        constructor(mdctBits, window, scale = 1) {
            this.SetTables(mdctBits);
            this.MdctBits = mdctBits;
            this.MdctSize = 1 << mdctBits;
            this.Scale = scale;
            if (window.length < this.MdctSize) {
                throw new Error("Window must be as long as the MDCT size.");
            }
            this._mdctPrevious = new Float64Array(this.MdctSize).fill(0);
            this._imdctPrevious = new Float64Array(this.MdctSize).fill(0);
            this._scratchMdct = new Float64Array(this.MdctSize).fill(0);
            this._scratchDct = new Float64Array(this.MdctSize).fill(0);
            this._imdctWindow = window;
        }
        SetTables(maxBits) {
            if (maxBits > Mdct._tableBits) {
                for (let i = Mdct._tableBits + 1; i <= maxBits; i++) {
                    const [sin, cos] = Mdct.GenerateTrigTables(i);
                    Mdct.SinTables.push(sin);
                    Mdct.CosTables.push(cos);
                    Mdct.ShuffleTables.push(this.GenerateShuffleTable(i));
                }
                Mdct._tableBits = maxBits;
            }
        }
        RunMdct(input, output) {
            if (input.length < this.MdctSize || output.length < this.MdctSize) {
                throw new Error("Input and output must be as long as the MDCT size.");
            }
            const size = this.MdctSize;
            const half = size / 2;
            const dctIn = this._scratchMdct;
            for (let i = 0; i < half; i++) {
                const a = this._imdctWindow[half - i - 1] * -input[half + i];
                const b = this._imdctWindow[half + i] * input[half - i - 1];
                const c = this._imdctWindow[i] * this._mdctPrevious[i];
                const d = this._imdctWindow[size - i - 1] * this._mdctPrevious[size - i - 1];
                dctIn[i] = a - b;
                dctIn[half + i] = c - d;
            }
            this.Dct4(dctIn, output);
            output.set(input, 0);
            this._mdctPrevious.set(input, 0);
        }
        RunImdct(input, output) {
            if (input.length < this.MdctSize || output.length < this.MdctSize) {
                throw new Error("Input and output must be as long as the MDCT size.");
            }
            const size = this.MdctSize;
            const half = size / 2;
            const dctOut = this._scratchMdct;
            this.Dct4(input, dctOut);
            for (let i = 0; i < half; i++) {
                output[i] = this._imdctWindow[i] * dctOut[i + half] + this._imdctPrevious[i];
                output[i + half] = this._imdctWindow[i + half] * -dctOut[size - 1 - i] - this._imdctPrevious[i + half];
                this._imdctPrevious[i] = this._imdctWindow[size - 1 - i] * -dctOut[half - i - 1];
                this._imdctPrevious[i + half] = this._imdctWindow[half - i - 1] * dctOut[i];
            }
        }
        Dct4(input, output) {
            const shuffleTable = Mdct.ShuffleTables[this.MdctBits];
            const sinTable = Mdct.SinTables[this.MdctBits];
            const cosTable = Mdct.CosTables[this.MdctBits];
            const dctTemp = this._scratchDct;
            const size = this.MdctSize;
            const lastIndex = size - 1;
            const halfSize = size / 2;
            for (let i = 0; i < halfSize; i++) {
                const i2 = i * 2;
                const a = input[i2];
                const b = input[lastIndex - i2];
                const sin = sinTable[i];
                const cos = cosTable[i];
                dctTemp[i2] = a * cos + b * sin;
                dctTemp[i2 + 1] = a * sin - b * cos;
            }
            const stageCount = this.MdctBits - 1;
            for (let stage = 0; stage < stageCount; stage++) {
                const blockCount = 1 << stage;
                const blockSizeBits = stageCount - stage;
                const blockHalfSizeBits = blockSizeBits - 1;
                const blockSize = 1 << blockSizeBits;
                const blockHalfSize = 1 << blockHalfSizeBits;
                const sinTable = Mdct.SinTables[blockHalfSizeBits];
                const cosTable = Mdct.CosTables[blockHalfSizeBits];
                for (let block = 0; block < blockCount; block++) {
                    for (let i = 0; i < blockHalfSize; i++) {
                        const frontPos = (block * blockSize + i) * 2;
                        const backPos = frontPos + blockSize;
                        const a = dctTemp[frontPos] - dctTemp[backPos];
                        const b = dctTemp[frontPos + 1] - dctTemp[backPos + 1];
                        const sin = sinTable[i];
                        const cos = cosTable[i];
                        dctTemp[frontPos] += dctTemp[backPos];
                        dctTemp[frontPos + 1] += dctTemp[backPos + 1];
                        dctTemp[backPos] = a * cos + b * sin;
                        dctTemp[backPos + 1] = a * sin - b * cos;
                    }
                }
            }
            for (let i = 0; i < size; i++) {
                output[i] = dctTemp[shuffleTable[i]] * this.Scale;
            }
        }
        static GenerateTrigTables(sizeBits) {
            const size = 1 << sizeBits;
            const sin = new Float64Array(size);
            const cos = new Float64Array(size);
            for (let i = 0; i < size; i++) {
                const value = Math.PI * (4 * i + 1) / (4 * size);
                sin[i] = Math.sin(value);
                cos[i] = Math.cos(value);
            }
            return [sin, cos];
        }
        GenerateShuffleTable(sizeBits) {
            const size = 1 << sizeBits;
            const table = new Int32Array(size);
            for (let i = 0; i < size; i++) {
                table[i] = Bit.bitReverse32WithBitCount(i ^ (i / 2), sizeBits);
            }
            return table;
        }
    }
    Mdct._tableBits = -1;
    Mdct.SinTables = [];
    Mdct.CosTables = [];
    Mdct.ShuffleTables = [];

    class Channel {
        constructor(parentBlock, channelIndex) {
            this.Block = parentBlock;
            this.ChannelIndex = channelIndex;
            this.Config = parentBlock.Config;
            this.Mdct = new Mdct(this.Config.FrameSamplesPower, Tables$1.ImdctWindow[this.Config.FrameSamplesPower - 6]);
            this.Pcm = new Float64Array(256).fill(0);
            this.Spectra = new Float64Array(256).fill(0);
            this.CodedQuantUnits = 0;
            this.ScaleFactorCodingMode = 0;
            this.ScaleFactors = new Int8Array(31);
            this.ScaleFactorsPrev = new Int8Array(31);
            this.Precisions = new Int8Array(30);
            this.PrecisionsFine = new Int8Array(30);
            this.PrecisionMask = new Array(30).fill(0);
            this.SpectraValuesBuffer = new Int32Array(16);
            this.CodebookSet = new Array(30).fill(0);
            this.QuantizedSpectra = new Int32Array(256);
            this.QuantizedSpectraFine = new Array(256).fill(0);
            this.BexMode = 0;
            this.BexValueCount = 0;
            this.BexValues = new Array(4).fill(0);
            this.BexScales = new Array(6).fill(0);
            this.Rng = null;
        }
        get IsPrimary() { return this.Block.PrimaryChannelIndex == this.ChannelIndex; }
        updateCodedUnits() {
            this.CodedQuantUnits = this.IsPrimary ? this.Block.QuantizationUnitCount : this.Block.StereoQuantizationUnit;
        }
    }

    class Block {
        get PrimaryChannel() { return this.Channels[this.PrimaryChannelIndex == 0 ? 0 : 1]; }
        get SecondaryChannel() { return this.Channels[this.PrimaryChannelIndex == 0 ? 1 : 0]; }
        constructor(parentFrame, blockIndex) {
            this.Frame = parentFrame;
            this.BlockIndex = blockIndex;
            this.Config = parentFrame.Config;
            this.BlockType = this.Config.ChannelConfig.BlockTypes[blockIndex];
            this.ChannelCount = this.blockTypeToChannelCount(this.BlockType);
            this.Channels = Array.from({ length: this.ChannelCount }, (_, i) => new Channel(this, i));
            this.Gradient = new Int32Array(31);
            this.JointStereoSigns = new Int32Array(30);
        }
        blockTypeToChannelCount(blockType) {
            switch (blockType) {
                case BlockType.Mono:
                    return 1;
                case BlockType.Stereo:
                    return 2;
                case BlockType.LFE:
                    return 1;
                default:
                    return 0;
            }
        }
    }

    class Frame {
        constructor(config) {
            this.Config = config;
            this.FrameIndex = 0;
            this.Blocks = new Array(config.ChannelConfig.BlockCount);
            for (let i = 0; i < config.ChannelConfig.BlockCount; i++) {
                this.Blocks[i] = new Block(this, i);
            }
        }
    }

    class Quantization {
        static dequantizeSpectra(block) {
            for (const channel of block.Channels) {
                channel.Spectra.fill(0);
                for (let i = 0; i < channel.CodedQuantUnits; i++) {
                    Quantization.dequantizeQuantUnit(channel, i);
                }
            }
        }
        static dequantizeQuantUnit(channel, band) {
            const subBandIndex = Tables$1.QuantUnitToCoeffIndex[band];
            const subBandCount = Tables$1.QuantUnitToCoeffCount[band];
            const stepSize = Tables$1.QuantizerStepSize[channel.Precisions[band]];
            const stepSizeFine = Tables$1.QuantizerFineStepSize[channel.PrecisionsFine[band]];
            for (let sb = 0; sb < subBandCount; sb++) {
                const coarse = channel.QuantizedSpectra[subBandIndex + sb] * stepSize;
                const fine = channel.QuantizedSpectraFine[subBandIndex + sb] * stepSizeFine;
                channel.Spectra[subBandIndex + sb] = coarse + fine;
            }
        }
        static scaleSpectrum(block) {
            for (const channel of block.Channels) {
                Quantization.scaleSpectrumChannel(channel);
            }
        }
        static scaleSpectrumChannel(channel) {
            const quantUnitCount = channel.Block.QuantizationUnitCount;
            const spectra = channel.Spectra;
            for (let i = 0; i < quantUnitCount; i++) {
                for (let sb = Tables$1.QuantUnitToCoeffIndex[i]; sb < Tables$1.QuantUnitToCoeffIndex[i + 1]; sb++) {
                    spectra[sb] *= Tables$1.SpectrumScale[channel.ScaleFactors[i]];
                }
            }
        }
    }

    class Stereo {
        static applyIntensityStereo(block) {
            if (block.BlockType !== BlockType.Stereo)
                return;
            const totalUnits = block.QuantizationUnitCount;
            const stereoUnits = block.StereoQuantizationUnit;
            if (stereoUnits >= totalUnits)
                return;
            const source = block.PrimaryChannel;
            const dest = block.SecondaryChannel;
            for (let i = stereoUnits; i < totalUnits; i++) {
                const sign = block.JointStereoSigns[i];
                for (let sb = Tables$1.QuantUnitToCoeffIndex[i]; sb < Tables$1.QuantUnitToCoeffIndex[i + 1]; sb++) {
                    if (sign > 0) {
                        dest.Spectra[sb] = -source.Spectra[sb];
                    }
                    else {
                        dest.Spectra[sb] = source.Spectra[sb];
                    }
                }
            }
        }
    }

    class InvalidDataException extends Error {
    }

    class ScaleFactors {
        static read(reader, channel) {
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
                        if (channel.Block.FirstInSuperframe)
                            throw new InvalidDataException();
                        ScaleFactors.readVlcDistanceToBaseline(reader, channel, channel.ScaleFactorsPrev, channel.Block.QuantizationUnitsPrev);
                        break;
                    case 3:
                        if (channel.Block.FirstInSuperframe)
                            throw new InvalidDataException();
                        ScaleFactors.readVlcDeltaOffsetWithBaseline(reader, channel, channel.ScaleFactorsPrev, channel.Block.QuantizationUnitsPrev);
                        break;
                }
            }
            else {
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
                        if (channel.Block.FirstInSuperframe)
                            throw new InvalidDataException();
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
        static readClcOffset(reader, channel) {
            const maxBits = 5;
            const sf = channel.ScaleFactors;
            const bitLength = reader.readInt(2) + 2;
            const baseValue = bitLength < maxBits ? reader.readInt(maxBits) : 0;
            for (let i = 0; i < channel.Block.ExtensionUnit; i++) {
                sf[i] = reader.readInt(bitLength) + baseValue;
            }
        }
        static readVlcDeltaOffset(reader, channel) {
            const weightIndex = reader.readInt(3);
            const weights = Tables$1.ScaleFactorWeights[weightIndex];
            const sf = channel.ScaleFactors;
            const baseValue = reader.readInt(5);
            const bitLength = reader.readInt(2) + 3;
            const codebook = Tables$1.HuffmanScaleFactorsUnsigned[bitLength];
            sf[0] = reader.readInt(bitLength);
            for (let i = 1; i < channel.Block.ExtensionUnit; i++) {
                const delta = Unpack.readHuffmanValue(codebook, reader);
                sf[i] = (sf[i - 1] + delta) & (codebook.ValueMax - 1);
            }
            for (let i = 0; i < channel.Block.ExtensionUnit; i++) {
                sf[i] += baseValue - weights[i];
            }
        }
        static readVlcDistanceToBaseline(reader, channel, baseline, baselineLength) {
            const sf = channel.ScaleFactors;
            const bitLength = reader.readInt(2) + 2;
            const codebook = Tables$1.HuffmanScaleFactorsSigned[bitLength];
            const unitCount = Math.min(channel.Block.ExtensionUnit, baselineLength);
            for (let i = 0; i < unitCount; i++) {
                const distance = Unpack.readHuffmanValue(codebook, reader, true);
                sf[i] = (baseline[i] + distance) & 31;
            }
            for (let i = unitCount; i < channel.Block.ExtensionUnit; i++) {
                sf[i] = reader.readInt(5);
            }
        }
        static readVlcDeltaOffsetWithBaseline(reader, channel, baseline, baselineLength) {
            const sf = channel.ScaleFactors;
            const baseValue = reader.readOffsetBinary(5, BitReader.OffsetBias.Negative);
            const bitLength = reader.readInt(2) + 1;
            const codebook = Tables$1.HuffmanScaleFactorsUnsigned[bitLength];
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

    class Unpack {
        static unpackFrame(reader, frame) {
            for (const block of frame.Blocks) {
                Unpack.unpackBlock(reader, block);
            }
        }
        static unpackBlock(reader, block) {
            Unpack.readBlockHeader(reader, block);
            if (block.BlockType === BlockType.LFE) {
                Unpack.unpackLfeBlock(reader, block);
            }
            else {
                Unpack.unpackStandardBlock(reader, block);
            }
            reader.alignPosition(8);
        }
        static readBlockHeader(reader, block) {
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
        static unpackStandardBlock(reader, block) {
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
        static readBandParams(reader, block) {
            const minBandCount = Tables$1.MinBandCount(block.Config.HighSampleRate);
            const maxExtensionBand = Tables$1.MaxExtensionBand(block.Config.HighSampleRate);
            block.BandCount = reader.readInt(4);
            block.BandCount += minBandCount;
            block.QuantizationUnitCount = Tables$1.BandToQuantUnitCount[block.BandCount];
            if (block.BandCount > Tables$1.MaxBandCount[block.Config.SampleRateIndex]) {
                throw new InvalidDataException();
            }
            if (block.BlockType === BlockType.Stereo) {
                block.StereoBand = reader.readInt(4);
                block.StereoBand += minBandCount;
                block.StereoQuantizationUnit = Tables$1.BandToQuantUnitCount[block.StereoBand];
            }
            else {
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
                block.ExtensionUnit = Tables$1.BandToQuantUnitCount[block.ExtensionBand];
            }
            else {
                block.ExtensionBand = block.BandCount;
                block.ExtensionUnit = block.QuantizationUnitCount;
            }
        }
        static readGradientParams(reader, block) {
            block.GradientMode = reader.readInt(2);
            if (block.GradientMode > 0) {
                block.GradientEndUnit = 31;
                block.GradientEndValue = 31;
                block.GradientStartUnit = reader.readInt(5);
                block.GradientStartValue = reader.readInt(5);
            }
            else {
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
        static readStereoParams(reader, block) {
            if (block.BlockType !== BlockType.Stereo) {
                return;
            }
            block.PrimaryChannelIndex = reader.readInt(1);
            block.HasJointStereoSigns = reader.readBool();
            if (block.HasJointStereoSigns) {
                for (let i = block.StereoQuantizationUnit; i < block.QuantizationUnitCount; i++) {
                    block.JointStereoSigns[i] = reader.readInt(1);
                }
            }
            else {
                block.JointStereoSigns.fill(0);
            }
        }
        static readExtensionParams(reader, block) {
            function readHeader(channel) {
                const bexMode = reader.readInt(2);
                channel.BexMode = bexBand > 2 ? bexMode : 4;
                channel.BexValueCount = Tables$1.BexEncodedValueCounts[channel.BexMode][bexBand];
            }
            function readData(channel) {
                for (let i = 0; i < channel.BexValueCount; i++) {
                    const dataLength = Tables$1.BexDataLengths[channel.BexMode][bexBand][i];
                    channel.BexValues[i] = reader.readInt(dataLength);
                }
            }
            let bexBand = 0;
            if (block.bandExtensionEnabled) {
                bexBand = BandExtension.getBexBandInfo(block.QuantizationUnitCount)[0];
                if (block.BlockType === BlockType.Stereo) {
                    readHeader(block.Channels[1]);
                }
                else {
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
        static calculateSpectrumCodebookIndex(channel) {
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
                    if (sf[i] - minSf >= 2 && sf[i] >= avg - (Tables$1.QuantUnitToCoeffCount[i] === 16 ? 1 : 0)) {
                        channel.CodebookSet[i] = 1;
                    }
                }
            }
            sf[quantUnits] = originalScaleTmp;
        }
        static readSpectra(reader, channel) {
            const values = channel.SpectraValuesBuffer;
            channel.QuantizedSpectra.fill(0);
            const maxHuffPrecision = Tables$1.MaxHuffPrecision(channel.Config.HighSampleRate);
            for (let i = 0; i < channel.CodedQuantUnits; i++) {
                const subbandCount = Tables$1.QuantUnitToCoeffCount[i];
                const precision = channel.Precisions[i] + 1;
                if (precision <= maxHuffPrecision) {
                    const huff = Tables$1.HuffmanSpectrum[channel.CodebookSet[i]][precision][Tables$1.QuantUnitToCodebookIndex[i]];
                    const groupCount = subbandCount >> huff.ValueCountPower;
                    for (let j = 0; j < groupCount; j++) {
                        values[j] = Unpack.readHuffmanValue(huff, reader);
                    }
                    Unpack.decodeHuffmanValues(channel.QuantizedSpectra, Tables$1.QuantUnitToCoeffIndex[i], subbandCount, huff, values);
                }
                else {
                    const subbandIndex = Tables$1.QuantUnitToCoeffIndex[i];
                    for (let j = subbandIndex; j < Tables$1.QuantUnitToCoeffIndex[i + 1]; j++) {
                        channel.QuantizedSpectra[j] = reader.readSignedInt(precision);
                    }
                }
            }
        }
        static readSpectraFine(reader, channel) {
            channel.QuantizedSpectraFine.fill(0);
            for (let i = 0; i < channel.CodedQuantUnits; i++) {
                if (channel.PrecisionsFine[i] > 0) {
                    const overflowBits = channel.PrecisionsFine[i] + 1;
                    const startSubband = Tables$1.QuantUnitToCoeffIndex[i];
                    const endSubband = Tables$1.QuantUnitToCoeffIndex[i + 1];
                    for (let j = startSubband; j < endSubband; j++) {
                        channel.QuantizedSpectraFine[j] = reader.readSignedInt(overflowBits);
                    }
                }
            }
        }
        static decodeHuffmanValues(spectrum, index, bandCount, huff, values) {
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
        static readHuffmanValue(huff, reader, signed = false) {
            const code = reader.peekInt(huff.MaxBitSize);
            const value = huff.Lookup[code];
            const bits = huff.Bits[value];
            reader.position += bits;
            return signed ? Bit.signExtend32(value, huff.ValueBits) : value;
        }
        static unpackLfeBlock(reader, block) {
            const channel = block.Channels[0];
            block.QuantizationUnitCount = 2;
            Unpack.decodeLfeScaleFactors(reader, channel);
            Unpack.calculateLfePrecision(channel);
            channel.CodedQuantUnits = block.QuantizationUnitCount;
            Unpack.readLfeSpectra(reader, channel);
        }
        static decodeLfeScaleFactors(reader, channel) {
            channel.ScaleFactors.fill(0);
            for (let i = 0; i < channel.Block.QuantizationUnitCount; i++) {
                channel.ScaleFactors[i] = reader.readInt(5);
            }
        }
        static calculateLfePrecision(channel) {
            const block = channel.Block;
            const precision = block.ReuseBandParams ? 8 : 4;
            for (let i = 0; i < block.QuantizationUnitCount; i++) {
                channel.Precisions[i] = precision;
                channel.PrecisionsFine[i] = 0;
            }
        }
        static readLfeSpectra(reader, channel) {
            channel.QuantizedSpectra.fill(0);
            for (let i = 0; i < channel.CodedQuantUnits; i++) {
                if (channel.Precisions[i] <= 0) {
                    continue;
                }
                const precision = channel.Precisions[i] + 1;
                for (let j = Tables$1.QuantUnitToCoeffIndex[i]; j < Tables$1.QuantUnitToCoeffIndex[i + 1]; j++) {
                    channel.QuantizedSpectra[j] = reader.readSignedInt(precision);
                }
            }
        }
    }

    class Atrac9Decoder {
        constructor() {
            this.Initialized = false;
        }
        initialize(configData) {
            this.Config = new Atrac9Config(configData);
            this.Frame = new Frame(this.Config);
            this.Reader = new BitReader(null);
            this.Initialized = true;
        }
        decode(atrac9Data, pcmOut) {
            if (!this.Initialized) {
                throw new Error("Decoder must be initialized before decoding.");
            }
            this.validateDecodeBuffers(atrac9Data, pcmOut);
            this.Reader.setBuffer(atrac9Data);
            this.decodeSuperFrame(pcmOut);
        }
        validateDecodeBuffers(atrac9Buffer, pcmBuffer) {
            if (!this.Config) {
                throw new Error("uninitialized");
            }
            if (!atrac9Buffer) {
                throw new Error("ATRAC9 buffer is required.");
            }
            if (!pcmBuffer) {
                throw new Error("PCM buffer is required.");
            }
            if (atrac9Buffer.length < this.Config.SuperframeBytes) {
                throw new Error("ATRAC9 buffer is too small.");
            }
            if (pcmBuffer.length < this.Config.ChannelCount) {
                throw new Error("PCM buffer is too small.");
            }
            for (let i = 0; i < this.Config.ChannelCount; i++) {
                if (!pcmBuffer[i] || pcmBuffer[i].length < this.Config.SuperframeSamples) {
                    throw new Error("PCM buffer is too small.");
                }
            }
        }
        decodeSuperFrame(pcmOut) {
            if (!this.Config || !this.Frame) {
                throw new Error("uninitialized");
            }
            for (let i = 0; i < this.Config.FramesPerSuperframe; i++) {
                this.Frame.FrameIndex = i;
                Atrac9Decoder.decodeFrame(this.Reader, this.Frame);
                if (pcmOut[0] instanceof Float32Array) {
                    this.pcmFloatOut(pcmOut, i * this.Config.FrameSamples);
                }
                else {
                    this.pcmFloatToShort(pcmOut, i * this.Config.FrameSamples);
                }
                this.Reader.alignPosition(8);
            }
        }
        pcmFloatOut(pcmOut, start) {
            if (!this.Config || !this.Frame) {
                throw new Error("uninitialized");
            }
            const endSample = start + this.Config.FrameSamples;
            let channelNum = 0;
            for (const block of this.Frame.Blocks) {
                for (const channel of block.Channels) {
                    const pcmSrc = channel.Pcm;
                    const pcmDest = pcmOut[channelNum++];
                    for (let d = 0, s = start; s < endSample; d++, s++) {
                        pcmDest[s] = pcmSrc[d] / 32767;
                    }
                }
            }
        }
        pcmFloatToShort(pcmOut, start) {
            if (!this.Config || !this.Frame) {
                throw new Error("uninitialized");
            }
            const endSample = start + this.Config.FrameSamples;
            let channelNum = 0;
            for (const block of this.Frame.Blocks) {
                for (const channel of block.Channels) {
                    const pcmSrc = channel.Pcm;
                    const pcmDest = pcmOut[channelNum++];
                    for (let d = 0, s = start; s < endSample; d++, s++) {
                        const sample = pcmSrc[d];
                        const roundedSample = Math.floor(sample + 0.5);
                        pcmDest[s] = Helpers.Clamp16(roundedSample);
                    }
                }
            }
        }
        static decodeFrame(reader, frame) {
            Unpack.unpackFrame(reader, frame);
            for (const block of frame.Blocks) {
                Quantization.dequantizeSpectra(block);
                Stereo.applyIntensityStereo(block);
                Quantization.scaleSpectrum(block);
                BandExtension.applyBandExtension(block);
                this.imdctBlock(block);
            }
        }
        static imdctBlock(block) {
            for (const channel of block.Channels) {
                channel.Mdct.RunImdct(channel.Spectra, channel.Pcm);
            }
        }
    }

    class Atrac9Format extends AudioFormatBase {
        constructor(builder) {
            super(builder);
            this.AudioData = builder.AudioData;
            this.Config = builder.Config;
            this.EncoderDelay = builder.EncoderDelay;
        }
        decode(parameters) {
            const progress = parameters?.progress;
            progress?.setTotal(this.AudioData.length);
            const decoder = new Atrac9Decoder();
            decoder.initialize(this.Config.ConfigData);
            const config = decoder.Config;
            const pcmOut = Helpers.createJaggedArray(Uint16Array, config.ChannelCount, this.SampleCount);
            const pcmBuffer = Helpers.createJaggedArray(Uint16Array, config.ChannelCount, config.SuperframeSamples);
            for (let i = 0; i < this.AudioData.length; i++) {
                decoder.decode(this.AudioData[i], pcmBuffer);
                this.copyBuffer(pcmBuffer, pcmOut, this.EncoderDelay, i);
                progress?.reportAdd(1);
            }
            return pcmOut;
        }
        copyBuffer(bufferIn, bufferOut, startIndex, bufferIndex) {
            if (!bufferIn || !bufferOut || bufferIn.length === 0 || bufferOut.length === 0) {
                throw new Error("bufferIn and bufferOut must be non-null with a length greater than 0");
            }
            const bufferLength = bufferIn[0].length;
            const outLength = bufferOut[0].length;
            const currentIndex = bufferIndex * bufferLength - startIndex;
            const remainingElements = Math.min(outLength - currentIndex, outLength);
            const srcStart = Helpers.Clamp(0 - currentIndex, 0, bufferLength);
            const destStart = Math.max(currentIndex, 0);
            const length = Math.min(bufferLength - srcStart, remainingElements);
            if (length <= 0)
                return;
            for (let c = 0; c < bufferOut.length; c++) {
                bufferOut[c].set(bufferIn[c].slice(srcStart, srcStart + length), destStart);
            }
        }
    }

    class Atrac9FormatBuilder extends AudioFormatBaseBuilder {
        constructor(audioData, config, sampleCount, encoderDelay) {
            super();
            if (!audioData || !config) {
                throw new Error("audioData and config are required parameters");
            }
            this.Config = config;
            this.AudioData = audioData;
            this.SampleRate = config.SampleRate;
            this.SampleCount = sampleCount;
            this.EncoderDelay = encoderDelay;
        }
        // Method to set loop parameters
        withLoop(looping, loopStart, loopEnd) {
            this.LoopStart = loopStart;
            this.LoopEnd = loopEnd;
            this.Looping = looping;
            return this; // Return the builder object for chaining
        }
        // Method to build Atrac9Format
        build() {
            return new Atrac9Format(this);
        }
    }

    class At9Reader extends AudioReader {
        constructor() {
            super();
            this.TConfig = At9Configuration;
        }
        readFile(stream, readAudioData = true) {
            const structure = new At9Structure();
            const parser = new RiffParser();
            parser.ReadDataChunk = readAudioData;
            parser.RegisterSubChunk("fact", At9FactChunk.parseAt9);
            parser.RegisterSubChunk("data", At9DataChunk.parseAt9);
            parser.FormatExtensibleParser = At9WaveExtensible.parseAt9;
            parser.ParseRiff(stream);
            this.validateAt9File(parser);
            const fmt = parser.GetSubChunk("fmt ");
            const ext = fmt.Ext;
            const fact = parser.GetSubChunk("fact");
            const data = parser.GetSubChunk("data");
            const smpl = parser.GetSubChunk("smpl");
            structure.Config = new Atrac9Config(ext.ConfigData);
            structure.SampleCount = fact.SampleCount;
            structure.EncoderDelay = fact.EncoderDelaySamples;
            structure.Version = ext.VersionInfo;
            structure.AudioData = data.AudioData;
            structure.SuperframeCount = data.FrameCount;
            if (smpl?.Loops?.[0]) {
                structure.LoopStart = smpl.Loops[0].Start - structure.EncoderDelay;
                structure.LoopEnd = smpl.Loops[0].End - structure.EncoderDelay;
                structure.Looping = structure.LoopEnd > structure.LoopStart;
            }
            return structure;
        }
        toAudioStream(structure) {
            return new Atrac9FormatBuilder(structure.AudioData, structure.Config, structure.SampleCount, structure.EncoderDelay)
                .withLoop(structure.Looping, structure.LoopStart, structure.LoopEnd)
                .build();
        }
        validateAt9File(parser) {
            if (parser.RiffChunk?.Type !== "WAVE") {
                throw new Error("Not a valid WAVE file");
            }
            const fmt = parser.GetSubChunk("fmt ");
            if (!fmt)
                throw new Error("File must have a valid fmt chunk");
            if (!fmt.Ext)
                throw new Error("File must have a format chunk extension");
            const ext = fmt.Ext;
            if (!parser.GetSubChunk("fact")) {
                throw new Error("File must have a valid fact chunk");
            }
            if (!parser.GetSubChunk("data")) {
                throw new Error("File must have a valid data chunk");
            }
            if (fmt.ChannelCount === 0) {
                throw new Error("Channel count must not be zero");
            }
            if (indexedDB.cmp(ext.SubFormat.bytes, MediaSubtypes.mediaSubtypeAtrac9) !== 0) {
                throw new Error(`Must contain ATRAC9 data. Has unsupported SubFormat ${ext.SubFormat}`);
            }
        }
    }
    At9Reader.Init = Promise.all([Tables$1.Init]);

    class At9Player extends EventTarget {
        constructor() {
            super();
            this.currentFrame = 0;
            this.endFrame = 0;
            this.isPaused = false;
            this.decoder = new Atrac9Decoder();
        }
        initialize() {
            if (this.audioContext)
                return;
            this.audioContext = new AudioContext();
        }
        async playUrl(url) {
            console.log("playUrl", url);
            const r = await fetch(url);
            this.play(await r.arrayBuffer());
        }
        play(buffer) {
            this.initialize();
            this.stop();
            const stream = At9Player.reader.readStream(buffer);
            const audio = stream.audio;
            this.currentStream = audio;
            this.currentFrame = 0;
            this.endFrame = (audio.Looping ? audio.LoopEnd + audio.EncoderDelay : audio.SampleCount) / audio.Config.SuperframeSamples;
            this.decoder.initialize(audio.Config.ConfigData);
            this.pcmBuffer = Helpers.createJaggedArray(Float32Array, audio.Config.ChannelCount, audio.Config.SuperframeSamples);
            this.scriptNode = this.audioContext.createScriptProcessor(audio.Config.SuperframeSamples, 0, audio.Config.ChannelCount);
            this.scriptNode.onaudioprocess = (ev) => { this.onAudioProcess(ev); };
            this.scriptNode.connect(this.audioContext.destination);
            this.dispatchEvent(new Event("play"));
            this.isPaused = false;
        }
        togglePause() {
            this.isPaused = !this.isPaused;
        }
        stop() {
            this.dispatchEvent(new Event("ended"));
            this.scriptNode?.disconnect();
            this.scriptNode = undefined;
            this.currentStream = undefined;
            this.currentFrame = 0;
            this.pcmBuffer = undefined;
        }
        onAudioProcess(ev) {
            if (!this.currentStream || this.isPaused) {
                for (let i = 0; i < (this.currentStream?.Config?.ChannelCount ?? 1); i++) {
                    ev.outputBuffer.copyToChannel(At9Player.zero, i);
                }
            }
            else {
                const frame = this.currentStream.AudioData[this.currentFrame];
                this.decoder.decode(frame, this.pcmBuffer);
                for (let i = 0; i < this.currentStream.Config.ChannelCount; i++) {
                    ev.outputBuffer.copyToChannel(this.pcmBuffer[i], i);
                }
                this.currentFrame++;
                if (this.currentFrame > this.endFrame) {
                    if (this.currentStream.Looping) {
                        this.currentFrame = Math.floor((this.currentStream.LoopStart + this.currentStream.EncoderDelay) / this.currentStream.Config.SuperframeSamples);
                    }
                    else {
                        this.stop();
                    }
                }
            }
        }
    }
    At9Player.reader = new At9Reader();
    At9Player.zero = new Float32Array(1024);

    return At9Player;

})();
