module dff1(
    input wire clk,
    input wire dat,
    output wire q
);
    
    reg d;

    always@(posedge clk)
        d <= dat;

    assign q = d;

    
endmodule

