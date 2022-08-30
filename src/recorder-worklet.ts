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
            return true
        }

        if(this.framesLeft <= 0) return true

        const input = inputs[0]
        const output = outputs[0]
        
        for(var c = 0; c < input.length; c++) {
            const cin = input[c]
            const cout = output[c]
            for(var i = 0; i < cin.length; i++) cout[i] = cin[i]
        }

        this.port.postMessage(input)

        if(this.framesLeft > 0) this.framesLeft--

        return true
    }
}

registerProcessor('recorder-processor', RecorderProcessor)