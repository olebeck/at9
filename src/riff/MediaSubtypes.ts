export class MediaSubtypes {
    static mediaSubtypePcm = new Uint8Array([1, 0, 0, 0, 0, 0, 16, 0, 128, 0, 0, 170, 0, 56, 57, 183, 113]);
    static mediaSubtypeAtrac9 = new Uint8Array([210, 66, 225, 71, 186, 54, 141, 77, 136, 252, 97, 101, 79, 140, 131, 108]);
  
    static parseGuid(bytes: Uint8Array) {
      if (!(bytes instanceof Uint8Array) || bytes.length !== 16) {
        throw new Error('Invalid byte array for GUID');
      }
  
      const hexArray = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));
  
      // Insert hyphens at the correct positions to match GUID format
      const guidString = `${hexArray.slice(0, 4).join('')}-${hexArray.slice(4, 6).join('')}-${hexArray.slice(6, 8).join('')}-${hexArray.slice(8, 10).join('')}-${hexArray.slice(10).join('')}`;
  
      return guidString;
    }
  }

export const WaveFormatTags = {
    WaveFormatPcm: 0x0001,
    WaveFormatExtensible: 0xFFFE,
};