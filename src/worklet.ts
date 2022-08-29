declare interface AudioWorkletProcessorImpl<T extends AudioWorkletProcessor> {
    new(): T
}

declare abstract class AudioWorkletProcessor {
    readonly port: MessagePort

    process(
        inputs: Float32Array[][],
        outputs: Float32Array[][],
        parameters: { [key: string]: Float32Array }
    ): boolean
}

declare function registerProcessor<T extends AudioWorkletProcessor>(
    name: string, processor: AudioWorkletProcessorImpl<T>
): void

declare interface AudioParamMap extends Map<string, AudioParam> {
    // readonly size: number
}

export class RecorderProcessor extends AudioWorkletProcessor {
    private framesLeft: number = 0

    constructor() {
        super()
        this.port.onmessage = e => this.framesLeft = e.data
    }

    process(
        inputs: Float32Array[][],
        outputs: Float32Array[][],
        parameters: { coefficient: Float32Array }
    ): boolean {
        if (inputs.length === 0 || outputs.length === 0) {
            return false
        }
        
        if(this.framesLeft <= 0) return false

        const input = inputs[0]
        const output = outputs[0]
        
        for(var c = 0; c < input.length; c++) {
            const cin = input[c]
            const cout = output[c]
            for(var i = 0; i < cin.length; i++) cout[i] = cin[i]
        }

        this.port.postMessage(input)

        if(this.framesLeft > 0) {
            this.framesLeft--
            return this.framesLeft > 0
        }

        return false
    }
}

registerProcessor('recorder-processor', RecorderProcessor)