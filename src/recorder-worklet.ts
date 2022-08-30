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
        if (inputs.length === 0 || outputs.length === 0 || this.framesLeft <= 0) {
            return true
        }
        this.framesLeft--

        // TODO: copy all channels; send all channels

        const input = inputs[0]
        const output = outputs[0]
        
        for(var c = 0; c < input.length; c++) {
            output[c].set(input[c])
        }

        this.port.postMessage(input)

        return true
    }
}

registerProcessor('recorder-processor', RecorderProcessor)