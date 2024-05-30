export default class UUID {
    bytes: Uint8Array
    constructor(bytes: Uint8Array) {
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