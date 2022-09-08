module test(
    input wire clk,
    input wire rst,
    output wire out
);

    reg value;

    always@(posedge clk) begin
        if(rst)
            value <= 0;
        else
            value <= 1;
    end

    assign out = value;

endmodule
