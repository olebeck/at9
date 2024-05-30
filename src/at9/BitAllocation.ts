import Block from "./Block.js";
import Channel from "./Channel.js";
import Tables from "./Tables.js";

export default class BitAllocation {
    static createGradient(block: Block): void {
        const valueCount: number = block.GradientEndValue - block.GradientStartValue;
        const unitCount: number = block.GradientEndUnit - block.GradientStartUnit;
      
        for (let i = 0; i < block.GradientEndUnit; i++) {
          block.Gradient[i] = block.GradientStartValue;
        }
      
        for (let i = block.GradientEndUnit; i <= block.QuantizationUnitCount; i++) {
          block.Gradient[i] = block.GradientEndValue;
        }
      
        if (unitCount <= 0 || valueCount == 0) {
          return;
        }
      
        const curve: number[] = Tables.GradientCurves[unitCount - 1];
        if (valueCount <= 0)
        {
            const scale = (-valueCount - 1) / 31.0;
            const baseVal = block.GradientStartValue - 1;
            for (let i = block.GradientStartUnit; i < block.GradientEndUnit; i++)
            {
                block.Gradient[i] = baseVal - Math.floor(curve[i - block.GradientStartUnit] * scale);
            }
        }
        else
        {
            const scale = (valueCount - 1) / 31.0;
            const baseVal = block.GradientStartValue + 1;
            for (let i = block.GradientStartUnit; i < block.GradientEndUnit; i++)
            {
                block.Gradient[i] = baseVal + Math.floor(curve[i - block.GradientStartUnit] * scale);
            }
        }
    }

    static calculateMask(channel: Channel) {
        channel.PrecisionMask.fill(0);
        for (let i = 1; i < channel.Block.QuantizationUnitCount; i++) {
            const delta = channel.ScaleFactors[i] - channel.ScaleFactors[i - 1];
            if (delta > 1) {
                channel.PrecisionMask[i] += Math.min(delta - 1, 5);
            } else if (delta < -1) {
                channel.PrecisionMask[i - 1] += Math.min(delta * -1 - 1, 5);
            }
        }
    }

    static calculatePrecisions(channel: Channel) {
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
        } else {
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

    static GenerateGradientCurves(): number[][] {
        const main = [
            1,  1,  1,  1,  2,  2,  2,  2,  3,  3,  3,  4,  4,  5,  5,  6,  7,  8,  9,  10, 11, 12, 13, 15,
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