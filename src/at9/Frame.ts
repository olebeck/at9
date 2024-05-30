import Atrac9Config from "./Atrac9Config.js";
import Block from "./Block.js";

export default class Frame {
    Config: Atrac9Config
    FrameIndex: number
    Blocks: Block[]
    constructor(config: Atrac9Config) {
        this.Config = config;
        this.FrameIndex = 0;
        this.Blocks = new Array(config.ChannelConfig.BlockCount);

        for (let i = 0; i < config.ChannelConfig.BlockCount; i++) {
            this.Blocks[i] = new Block(this, i);
        }
    }
}