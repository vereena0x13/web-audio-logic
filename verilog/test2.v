module test2(
    input wire clk,
    output wire y
);

    wire ff0;
    dff1 g0(
        .clk(clk),
        .dat(~ff0),
        .q(ff0)
    );

    assign y = ff0;

endmodule
