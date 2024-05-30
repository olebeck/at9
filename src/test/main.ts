import AT9Reader from '../at9/At9Reader.js';
import Atrac9Decoder from '../at9/Atrac9Decoder.js';
import Atrac9Format from '../at9/Atrac9Format.js';
import At9Player from '../At9Player.js';
import Helpers from '../utilities/Helpers.js';


const player = new At9Player();

function play_button(selector: string, filename: string) {
    document.querySelector(selector)!.addEventListener("click", (ev) => {
        player.playUrl(filename);
    });
}

play_button("#play-home", "systembgm/home.at9");
play_button("#play-initialsetup", "systembgm/initialsetup.at9");
play_button("#play-near", "systembgm/near.at9");
play_button("#play-signup", "systembgm/signup.at9");
play_button("#play-store", "systembgm/store.at9");
document.querySelector("#pause")!.addEventListener("click", (ev) => {
    player.togglePause();
});


let _canplay: (a?: any) => void;
const CanPlay = new Promise((resolve) => {
    _canplay = resolve;
});

document.querySelector("#play")?.addEventListener("click", () => {_canplay()});
const progress = document.querySelector("#progress");

(async () => {
    const reader = new AT9Reader();

    const r = await fetch("systembgm/home.at9");
    await AT9Reader.Init;
    const stream = reader.readStream(await r.arrayBuffer());
    const audio = stream.audio as Atrac9Format;

    const decoder = new Atrac9Decoder();
    decoder.initialize(audio.Config.ConfigData);
    const pcmBuffer = Helpers.createJaggedArray(Float32Array, audio.Config.ChannelCount, audio.Config.SuperframeSamples);

    await CanPlay;
    const audioCtx = new window.AudioContext();
    const scriptNode = audioCtx.createScriptProcessor(audio.Config.SuperframeSamples, 0, audio.Config.ChannelCount);

    const end = (audio.Looping ? audio.LoopEnd+audio.EncoderDelay : audio.SampleCount) / audio.Config.SuperframeSamples;
    
    let i = 0;
    scriptNode.onaudioprocess = (ev) => {
        decoder.decode(audio.AudioData[i], pcmBuffer);
        ev.outputBuffer.copyToChannel(pcmBuffer[0], 0)
        ev.outputBuffer.copyToChannel(pcmBuffer[1], 1)
        progress!.textContent = `${i} / ${end}`
        i++;
        if(i > end) {
            if(audio.Looping) {
                i = Math.floor((audio.LoopStart+audio.EncoderDelay) / audio.Config.SuperframeSamples);
            } else {
                scriptNode.disconnect();
            }
        }
    }
    
    scriptNode.connect(audioCtx.destination);
    

    //decoder.decode(audio.audioData[1652], pcmBuffer);

    /*
    for (let i = 0; i < audio.audioData.length; i++) {
        decoder.decode(audio.audioData[i], pcmBuffer);
    }
    */
})();

console.log("a");