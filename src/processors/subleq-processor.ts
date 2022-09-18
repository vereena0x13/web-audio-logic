import { AudioLogicProcessor } from "../audio-logic";
import { Dictionary } from "../util";

export class SubleqProcessor extends AudioLogicProcessor {
    private clk: boolean = false
    private rst = 4
    private memory: number[] = new Array(256).fill(0)
    private printBuffer: number[] = []
    private ticksLeft = 5400

    constructor() {
        super()
        const code = [0, 0, 47, 0, -1, 1, 2, 3, 4, 10, 32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 48, 45, 10, 100, 1000, 10000, 24, 72, 101, 108, 108, 111, 44, 32, 87, 111, 114, 108, 100, 33, 10, 0, 29, 0, 0, 46, 46, 50, 62, 62, 53, 44, 3, 56, 3, 62, 59, 3, 3, 62, 0, 3, 65, 3, 46, 68, 3, 3, 71, 3, 46, 77, 3, 3, 86, 46, 3, 83, 3, 3, 86, 3, 3, 101, 46, 3, 89, 3, -7, 92, 3, 3, 95, 4, 44, 98, 3, 3, 47, 3, 3, 101]
        code.forEach((v, i) => this.memory[i] = v)
    }

    update(model: any): boolean {
        if(!this.clk && this.rst === 0) {
            function unsign(n: number): number {
                return n & 0xFF
            }
        
            function sign(n: number): number {
                const r = unsign(n)
                return r > 0x7F ? r - 0x100 : r
            }

            const waddr = sign(model.o_waddr)
            const wdata = sign(model.o_wdata)
            const raddr = sign(model.o_raddr)

            if(model.o_we === 1) {
                console.log(`write ${wdata} to ${waddr}`)
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
            model.i_rdata = raddr < 0 ? 0 : unsign(this.memory[raddr])
        }


        model.i_rstn = this.rst > 0 ? 0 : 1
        model.i_clk = this.clk ? 1 : 0

        this.clk = !this.clk

        if(this.rst > 0) this.rst--


        this.ticksLeft--
        if(this.ticksLeft <= 0) {
            return false
        }


        return true
    }
}