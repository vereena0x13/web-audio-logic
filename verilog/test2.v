module test2(
    input wire clk,
    output wire [1:0] y
);

    wire ff0;
    wire ff1;
    wire ff0x1;

    dff1 g0(
        .clk(clk),
        .dat(~ff0),
        .q(ff0)
    );

    dff1 g1(
        .clk(clk),
        .dat(ff0x1),
        .q(ff1)
    );

    xor2 g2(
        .a(ff0),
        .b(ff1),
        .y(ff0x1)
    );

    assign y = {ff1, ff0};

endmodule
