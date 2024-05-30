export default class Helpers {
    static createJaggedArray<T>(type: { new (length: number): T; },...lengths: number[]): T[] {
        return this.initializeJaggedArray<T>(type, 0, lengths) as T[];
    }
    
    static initializeJaggedArray<T>(type: { new (length: number): T; }, index: number, lengths: number[]): T | T[] {
        if(index == lengths.length-1) {
            return new type(lengths[index]);
        } else {
            const array = new Array(lengths[index]) as any[];
            for (let i = 0; i < lengths[index]; i++) {
                array[i] = this.initializeJaggedArray<T>(type, index + 1, lengths);
            }
            return array as T;
        }
    }

    static Clamp16(value: number) {
        if(value > 32767) return 32767;
        if(value < -32768) return -32768;
        return value;
    }

    static Clamp(value: number, min: number, max: number)
    {
        if (value < min)
            return min;
        if (value > max)
            return max;
        return value;
    }

    static base64ToUint8Array(base64String: string) {
        const binaryString = atob(base64String);
        const uint8Array = new Uint8Array(binaryString.length);
    
        for (let i = 0; i < binaryString.length; i++) {
            uint8Array[i] = binaryString.charCodeAt(i);
        }
    
        return uint8Array;
    }
}