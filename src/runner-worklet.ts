import { AudioLogicProcessor } from "./audio-logic"
import { BLIF } from "./blif"
import { SubleqProcessor } from "./processors/subleq-processor"
import { Dictionary, framesToBits, bitsToNumber, numberToBits } from "./util"

class Bus {
    constructor(
        readonly name: string,
        readonly size: number
    ) {}
}

function computeBuses(xs: string[]): Bus[] {
    const sizes: Dictionary<number> = {}
    xs.forEach(x => {
        if(x.includes('[')) {
            const name = x.substring(0, x.indexOf('['))
            if(!(name in sizes)) sizes[name] = 0
            sizes[name]++
        } else {
            sizes[x] = 1
        }
    })
    const buses: Bus[] = []
    xs.forEach(x => {
        var name = x
        if(x.includes('[')) {
            name = x.substring(0, x.indexOf('['))
            if(buses.length > 0 && name === buses[buses.length-1].name) return
        }
        buses.push(new Bus(name, sizes[name]))
    })
    return buses
}

class RunnerProcessor extends AudioWorkletProcessor {
    private blif: BLIF | undefined
    private inputBuses: Bus[] | undefined
    private outputBuses: Bus[] | undefined

    private outputs: Dictionary<number> = {}
    private inputs: Dictionary<number> = {}

    private processor: AudioLogicProcessor = new SubleqProcessor() // TODO: un-hardcode this!

    private modelProxy: object | undefined

    constructor() {
        super()
        this.port.onmessage = e => {
            if(this.blif === undefined) {
                this.blif = e.data
                
                this.inputBuses = computeBuses(this.blif!.inputs)
                this.inputBuses!.forEach(bus => this.inputs[bus.name] = 0)

                this.outputBuses = computeBuses(this.blif!.outputs)

                const _outputs = this.outputs
                const _inputs = this.inputs

                this.modelProxy = new Proxy({}, {
                    get(target: object, name: string, receiver: any) {
                        if(name in _outputs) {
                            return _outputs[name]
                        }
                        return undefined
                    },
                    set(target: object, name: string, value: any, receiver: any) {
                        if(name in _inputs) {
                            _inputs[name] = value
                            return true
                        }
                        return false
                    },
                })
            }
        }
    }

    process(
        workletInputs: Float32Array[][],
        workletOutputs: Float32Array[][],
        parameters: Dictionary<Float32Array>
    ): boolean {
        if (workletInputs.length === 0 || workletOutputs.length === 0 || this.blif === undefined) {
            return true
        }
        if(workletInputs[0].length === 0) {
            return true
        }


        const pkt = framesToBits(workletInputs[0])
        var j = 0
        for(const bus of this.outputBuses!) {
            if(bus.size === 1) {
                this.outputs[bus.name] = pkt[j]
            } else {
                this.outputs[bus.name] = bitsToNumber(pkt.slice(j, j + bus.size))
            }
            j += bus.size
        }


        const keepRunning = this.processor.update(this.modelProxy)
        if(!keepRunning) {
            this.port.postMessage('done') // TODO
            return false
        }


        j = 0
        for(const bus of this.inputBuses!) {
            if(bus.size === 1) {
                workletOutputs[0][j].fill(this.inputs[bus.name], 0, 128)
            } else {
                const bits = numberToBits(this.inputs[bus.name], bus.size)
                for(var k = 0; k < bits.length; k++) {
                    workletOutputs[0][j + k].fill(bits[k], 0, 128)
                }
            }
            j += bus.size
        }


        return true
    }
}

registerProcessor('runner-processor', RunnerProcessor)