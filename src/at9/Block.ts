import Atrac9Config from "./Atrac9Config.js";
import { BlockType } from "./BlockType.js";
import Channel from "./Channel.js";
import Frame from "./Frame.js";

export default class Block {
    Config: Atrac9Config;
    BlockType: BlockType;
    BlockIndex: number;
    Frame: Frame;

    Channels: Channel[];
    ChannelCount: number;

    FirstInSuperframe!: boolean;
    ReuseBandParams!: boolean;

    BandCount!: number;
    StereoBand!: number;
    ExtensionBand!: number;
    QuantizationUnitCount!: number;
    StereoQuantizationUnit!: number;
    ExtensionUnit!: number;
    QuantizationUnitsPrev!: number;

    Gradient: Int32Array;
    GradientMode!: number;
    GradientStartUnit!: number;
    GradientStartValue!: number;
    GradientEndUnit!: number;
    GradientEndValue!: number;
    GradientBoundary!: number;

    PrimaryChannelIndex!: number;
    JointStereoSigns: Int32Array;
    HasJointStereoSigns!: boolean;
    get PrimaryChannel() { return this.Channels[this.PrimaryChannelIndex == 0 ? 0 : 1]}
    get SecondaryChannel() { return this.Channels[this.PrimaryChannelIndex == 0 ? 1 : 0]}

    bandExtensionEnabled!: boolean;
    hasExtensionData!: boolean;
    bexDataLength!: number;
    bexMode!: number;

    constructor(parentFrame: Frame, blockIndex: number) {
        this.Frame = parentFrame;
        this.BlockIndex = blockIndex;
        this.Config = parentFrame.Config;
        this.BlockType = this.Config.ChannelConfig.BlockTypes[blockIndex];
        this.ChannelCount = this.blockTypeToChannelCount(this.BlockType);
        this.Channels = Array.from({ length: this.ChannelCount }, (_, i) => new Channel(this, i));
        this.Gradient = new Int32Array(31);
        this.JointStereoSigns = new Int32Array(30);
    }

    private blockTypeToChannelCount(blockType: BlockType): number {
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