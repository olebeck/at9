import Block from "./Block.js";
import Channel from "./Channel.js";
import Tables from "./Tables.js";

export default class BandExtension {
    static applyBandExtension(block: Block) {
        if (!block.bandExtensionEnabled || !block.hasExtensionData) return;

        for (const channel of block.Channels) {
            BandExtension.applyBandExtensionChannel(channel);
        }
    }

    static applyBandExtensionChannel(channel: Channel) {
        const groupAUnit = channel.Block.QuantizationUnitCount;
        const scaleFactors = channel.ScaleFactors;
        const spectra = channel.Spectra;
        const scales = channel.BexScales;
        const values = channel.BexValues;

        const [bandCount, groupBUnit, groupCUnit] = BandExtension.getBexBandInfo(groupAUnit);
        const totalUnits = Math.max(groupCUnit, 22);

        const groupABin = Tables.QuantUnitToCoeffIndex![groupAUnit];
        const groupBBin = Tables.QuantUnitToCoeffIndex![groupBUnit];
        const groupCBin = Tables.QuantUnitToCoeffIndex![groupCUnit];
        const totalBins = Tables.QuantUnitToCoeffIndex![totalUnits];

        BandExtension.fillHighFrequencies(spectra, groupABin, groupBBin, groupCBin, totalBins);

        switch (channel.BexMode) {
            case 0:
                const bexQuantUnits = totalUnits - groupAUnit;

                switch (bandCount) {
                    case 3:
                        scales[0] = Tables.BexMode0Bands3![0][values[0]];
                        scales[1] = Tables.BexMode0Bands3![1][values[0]];
                        scales[2] = Tables.BexMode0Bands3![2][values[1]];
                        scales[3] = Tables.BexMode0Bands3![3][values[2]];
                        scales[4] = Tables.BexMode0Bands3![4][values[3]];
                        break;
                    case 4:
                        scales[0] = Tables.BexMode0Bands4![0][values[0]];
                        scales[1] = Tables.BexMode0Bands4![1][values[0]];
                        scales[2] = Tables.BexMode0Bands4![2][values[1]];
                        scales[3] = Tables.BexMode0Bands4![3][values[2]];
                        scales[4] = Tables.BexMode0Bands4![4][values[3]];
                        break;
                    case 5:
                        scales[0] = Tables.BexMode0Bands5![0][values[0]];
                        scales[1] = Tables.BexMode0Bands5![1][values[1]];
                        scales[2] = Tables.BexMode0Bands5![2][values[1]];
                        break;
                }

                scales[bexQuantUnits - 1] = Tables.SpectrumScale[scaleFactors[groupAUnit]];

                BandExtension.addNoiseToSpectrum(channel, Tables.QuantUnitToCoeffIndex[totalUnits - 1], Tables.QuantUnitToCoeffCount[totalUnits - 1]);
                BandExtension.scaleBexQuantUnits(spectra, scales, groupAUnit, totalUnits);
                break;
            case 1:
                for (let i = groupAUnit; i < totalUnits; i++) {
                    scales[i - groupAUnit] = Tables.SpectrumScale[scaleFactors[i]];
                }

                BandExtension.addNoiseToSpectrum(channel, groupABin, totalBins - groupABin);
                BandExtension.scaleBexQuantUnits(spectra, scales, groupAUnit, totalUnits);
                break;
            case 2:
                const groupAScale2 = Tables.BexMode2Scale![values[0]];
                const groupBScale2 = Tables.BexMode2Scale![values[1]];

                for (let i = groupABin; i < groupBBin; i++) {
                    spectra[i] *= groupAScale2;
                }

                for (let i = groupBBin; i < groupCBin; i++) {
                    spectra[i] *= groupBScale2;
                }
                return;
            case 3:
                const rate = Math.pow(2, Tables.BexMode3Rate![values[1]]);
                let scale = Tables.BexMode3Initial![values[0]];
                for (let i = groupABin; i < totalBins; i++) {
                    scale *= rate;
                    spectra[i] *= scale;
                }
                return;
            case 4:
                const mult = Tables.BexMode4Multiplier![values[0]];
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

    static scaleBexQuantUnits(spectra: Float64Array, scales: number[], startUnit: number, totalUnits: number) {
        for (let i = startUnit; i < totalUnits; i++) {
            for (let k = Tables.QuantUnitToCoeffIndex[i]; k < Tables.QuantUnitToCoeffIndex[i + 1]; k++) {
                spectra[k] *= scales[i - startUnit];
            }
        }
    }

    static fillHighFrequencies(spectra: Float64Array, groupABin: number, groupBBin: number, groupCBin: number, totalBins: number) {
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

    static addNoiseToSpectrum(channel: Channel, index: number, count: number) {
        if (!channel.Rng) {
            const sf = channel.ScaleFactors;
            const seed = 543 * (sf[8] + sf[12] + sf[15] + 1);
            channel.Rng = new Atrac9Rng(seed);
        }
        for (let i = 0; i < count; i++) {
            channel.Spectra[i + index] = channel.Rng.next() / 65535.0 * 2.0 - 1.0;
        }
    }

    static getBexBandInfo(quantUnits: number) {
        const groupAUnit = Tables.BexGroupInfo![quantUnits - 13][0];
        const groupBUnit = Tables.BexGroupInfo![quantUnits - 13][1];
        const bandCount = Tables.BexGroupInfo![quantUnits - 13][2];
        return [bandCount, groupAUnit, groupBUnit]
    }
}