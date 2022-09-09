module test2(
    input wire clk,
    output wire [1:0] y
);

    wire ff0;
    wire ff1;

    dff1 g0(
        .clk(clk),
        .dat(~ff0),
        .q(ff0)
    );

    dff1 g1(
        .clk(ff0),
        .dat(~ff1),
        .q(ff1)
    );

    assign y = {ff1, ff0};

endmodule
