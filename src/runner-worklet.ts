import { BLIF } from "./blif"
import { Dictionary, bitToFrame, frameToBit, framesToBits, bitsToNumber, numberToBits } from "./util"

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

export class RunnerProcessor extends AudioWorkletProcessor {
    private blif: BLIF | undefined
    private inputBuses: Bus[] | undefined
    private outputBuses: Bus[] | undefined

    private clk: boolean = true
    private rst: boolean = false
    private memory: number[] = new Array(256).fill(0)
    private printBuffer: number[] = []
    private inputs: Dictionary<number> = {}
    private ticksLeft = 5400

    constructor() {
        super()

        this.port.onmessage = e => {
            if(this.blif === undefined) {
                this.blif = e.data
                this.inputBuses = computeBuses(this.blif!.inputs)
                this.outputBuses = computeBuses(this.blif!.outputs)
                this.inputBuses!.forEach(bus => this.inputs[bus.name] = 0)
            }
        }

        const code = [0, 0, 47, 0, -1, 1, 2, 3, 4, 10, 32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 48, 45, 10, 100, 1000, 10000, 24, 72, 101, 108, 108, 111, 44, 32, 87, 111, 114, 108, 100, 33, 10, 0, 29, 0, 0, 46, 46, 50, 62, 62, 53, 44, 3, 56, 3, 62, 59, 3, 3, 62, 0, 3, 65, 3, 46, 68, 3, 3, 71, 3, 46, 77, 3, 3, 86, 46, 3, 83, 3, 3, 86, 3, 3, 101, 46, 3, 89, 3, -7, 92, 3, 3, 95, 4, 44, 98, 3, 3, 47, 3, 3, 101]
        code.forEach((v, i) => this.memory[i] = v)
    }

    process(
        workletInputs: Float32Array[][],
        workletOutputs: Float32Array[][],
        parameters: { coefficient: Float32Array }
    ): boolean {
        if (workletInputs.length === 0 || workletOutputs.length === 0 || this.blif === undefined) {
            return true
        }
        if(workletInputs[0].length === 0) {
            return true
        }


        if(!this.clk && this.rst) {
            const pkt = framesToBits(workletInputs[0])
            const outputs: Dictionary<number> = {}
            var j = 0
            for(const bus of this.outputBuses!) {
                if(bus.size === 1) {
                    outputs[bus.name] = pkt[j]
                } else {
                    outputs[bus.name] = bitsToNumber(pkt.slice(j, j + bus.size))
                }
                j += bus.size
            }


            function unsign(n: number): number {
                return n & 0xFF
            }
        
            function sign(n: number): number {
                const r = unsign(n)
                return r > 0x7F ? r - 0x100 : r
            }

            const waddr = sign(outputs['o_waddr'])
            const wdata = sign(outputs['o_wdata'])
            const raddr = sign(outputs['o_raddr'])

            if(outputs['o_we'] === 1) {
                if(waddr < 0) {
                    if(waddr == -7) {
                        if(wdata == 10) {
                            console.log(String.fromCharCode(...this.printBuffer))
                            this.printBuffer = []
                        } else {
                            this.printBuffer.push(wdata)
                        }
                    }
                } else {
                    this.memory[waddr] = wdata
                }
            }
            this.inputs['i_rdata'] = raddr < 0 ? 0 : unsign(this.memory[raddr])
        }


        this.inputs['i_rstn'] = this.rst ? 1 : 0
        this.inputs['i_clk'] = this.clk ? 1 : 0

        this.clk = !this.clk

        if(this.clk && !this.rst) this.rst = true


        var j = 0
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


        this.ticksLeft--
        if(this.ticksLeft <= 0) {
            this.port.postMessage('done')
            return false
        }


        return true
    }
}

registerProcessor('runner-processor', RunnerProcessor)