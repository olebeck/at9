import BinaryReader from "./BinaryReader.js";

type TypedArray =
  | Int8ArrayConstructor
  | Uint8ArrayConstructor
  | Int16ArrayConstructor
  | Uint16ArrayConstructor
  | Int32ArrayConstructor
  | Uint32ArrayConstructor
  | Float32ArrayConstructor
  | Float64ArrayConstructor
  | BigInt64ArrayConstructor
  | BigUint64ArrayConstructor;

export default class ArrayUnpacker {
    static GetHighNibble(value: number) { return ((value >> 4) & 0xF) & 0xff }
    static GetLowNibble(value: number) { return (value & 0xF) & 0xff }

    static async UnpackArrays(packedArrays: Uint8Array) {
        packedArrays = await this.TryDecompress(packedArrays);

        const reader = new BinaryReader(packedArrays.buffer);
        const compressed = reader.readUInt8();
        const version = reader.readUInt8();
        if (compressed !== 0 || version !== 0) throw new Error('Invalid data');

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

    static UnpackArray(reader: BinaryReader, outType: TypedArray, rank: number) {
        const modeType = reader.readUInt8();
        if (modeType === 0xFF) return null;

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
                    lengths[i] = reader.readUInt16()
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

    static ReadArray(reader: BinaryReader, storedType: TypedArray, outType: TypedArray, length: number) {
        if (length === 0xFFFF) return null;

        function copy(src: Uint8Array)  {
            var dst = new ArrayBuffer(src.byteLength);
            new Uint8Array(dst).set(src);
            return dst;
        }

        const lengthBytes = length * storedType.BYTES_PER_ELEMENT;
        const array = new storedType(copy(reader.readBytes(lengthBytes)));
        if(storedType == outType) return array;
        const array2 = new outType(array.length);
        for(let i = 0; i < array.length; i++) {
            array2[i] = array[i];
        }
        return array2;
    }

    static async TryDecompress(data: Uint8Array) {
        const compressed = data[0] === 1;
        if (compressed) {
            const decompressedLength = new DataView(data.buffer, 1, 4).getInt32(0, true);
            data = await this.inflateAsync(data, 5, decompressedLength);
        }
        return data;
    }

    static async inflateAsync(compressed: Uint8Array, startIndex: number, length: number) {
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
                if (done) break;
                resultChunks.push(value);
            }
    
            const out = new Uint8Array(resultChunks.map(r => r.byteLength).reduce((p, c) => p+c));
            let o = 0
            resultChunks.forEach(r => {
                out.set(r, o);
                o += r.byteLength;
            })

            return out;
        } catch (error) {
            throw new Error(`Inflation error: ${(error as Error).message}`);
        }
    }

    static UnpackInternal(outType: TypedArray, storedType: TypedArray, reader: BinaryReader, depth: number, dimensions: number[]) {
        if (depth >= dimensions.length) return null;
        if (depth === dimensions.length - 1) {
            return this.ReadArray(reader, storedType, outType, dimensions[depth]);
        }

        const array = new Array(dimensions[depth]);
        for (let i = 0; i < dimensions[depth]; i++) {
            array[i] = this.UnpackInternal(outType, storedType, reader, depth + 1, dimensions);
        }
        return array;
    }

    static TypeLookup: TypedArray[] = [
        Uint8Array, Int8Array, Uint8Array,
        Int16Array, Uint16Array,
        Int32Array, Uint32Array,
        BigInt64Array, BigUint64Array,
        Float32Array, Float64Array,
    ];
}