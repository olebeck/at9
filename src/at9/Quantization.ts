import Block from "./Block.js";
import Channel from "./Channel.js";
import Tables from "./Tables.js";

export default class Quantization {
    static dequantizeSpectra(block: Block) {
        for (const channel of block.Channels) {
            channel.Spectra.fill(0);

            for (let i = 0; i < channel.CodedQuantUnits; i++) {
                Quantization.dequantizeQuantUnit(channel, i);
            }
        }
    }

    static dequantizeQuantUnit(channel: Channel, band: number) {
        const subBandIndex = Tables.QuantUnitToCoeffIndex[band];
        const subBandCount = Tables.QuantUnitToCoeffCount[band];
        const stepSize = Tables.QuantizerStepSize[channel.Precisions[band]];
        const stepSizeFine = Tables.QuantizerFineStepSize[channel.PrecisionsFine[band]];

        for (let sb = 0; sb < subBandCount; sb++) {
            const coarse = channel.QuantizedSpectra[subBandIndex + sb] * stepSize;
            const fine = channel.QuantizedSpectraFine[subBandIndex + sb] * stepSizeFine;
            channel.Spectra[subBandIndex + sb] = coarse + fine;
        }
    }

    static scaleSpectrum(block: Block) {
        for (const channel of block.Channels) {
            Quantization.scaleSpectrumChannel(channel);
        }
    }

    static scaleSpectrumChannel(channel: Channel) {
        const quantUnitCount = channel.Block.QuantizationUnitCount;
        const spectra = channel.Spectra;

        for (let i = 0; i < quantUnitCount; i++) {
            for (let sb = Tables.QuantUnitToCoeffIndex[i]; sb < Tables.QuantUnitToCoeffIndex[i + 1]; sb++) {
                spectra[sb] *= Tables.SpectrumScale[channel.ScaleFactors[i]];
            }
        }
    }
}