import Block from "./Block.js";
import { BlockType } from "./BlockType.js";
import Tables from "./Tables.js";

export default class Stereo {
    static applyIntensityStereo(block: Block) {
        if (block.BlockType !== BlockType.Stereo) return;

        const totalUnits = block.QuantizationUnitCount;
        const stereoUnits = block.StereoQuantizationUnit;
        if (stereoUnits >= totalUnits) return;

        const source = block.PrimaryChannel;
        const dest = block.SecondaryChannel;

        for (let i = stereoUnits; i < totalUnits; i++) {
            const sign = block.JointStereoSigns[i];
            for (let sb = Tables.QuantUnitToCoeffIndex![i]; sb < Tables.QuantUnitToCoeffIndex![i + 1]; sb++) {
                if (sign > 0) {
                    dest.Spectra[sb] = -source.Spectra[sb];
                } else {
                    dest.Spectra[sb] = source.Spectra[sb];
                }
            }
        }
    }
}