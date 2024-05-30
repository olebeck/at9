import { BlockType } from "./BlockType.js";

export default class ChannelConfig {
    BlockCount: number;
    BlockTypes: BlockType[];
    ChannelCount: number;
    constructor(...blockTypes: BlockType[]) {
        this.BlockCount = blockTypes.length;
        this.BlockTypes = blockTypes;
        this.ChannelCount = blockTypes.reduce((count, type) => count + this.blockTypeToChannelCount(type), 0);
    }

    blockTypeToChannelCount(blockType: BlockType) {
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