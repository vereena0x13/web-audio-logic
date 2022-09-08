import { WorkerUrl } from 'worker-url'
import { makeAudioContext } from "./util"

export class AudioLogicContext {
    readonly ctx = makeAudioContext()

    private recorder?: AudioWorkletNode

    async start() {
        await this.ctx.audioWorklet.addModule(new WorkerUrl(new URL('./recorder-worklet.ts', import.meta.url), { name: 'recorder-processor' }))

        this.recorder = new AudioWorkletNode(this.ctx, 'recorder-processor', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            channelCount: 3,
        })
    }
}

export class AudioLogicNode {

}

