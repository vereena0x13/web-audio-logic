import { AudioLogicProcessor } from "../audio-logic";
import { Dictionary } from "../util";

export class TestProcessor extends AudioLogicProcessor {
    private clk = false
    private ticksLeft = 2*10

    update(model: any): boolean {
        model.rst = 0

        this.clk = !this.clk
        model.clk = this.clk ? 1 : 0

        if(!this.clk) {
            console.log(model)
        }


        return this.ticksLeft-->0
    }
}