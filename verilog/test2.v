module test2(
    input wire a,
    input wire b,
    input wire c,
    output wire y
);

    wire ay;
    or2 a0(
        .a(a),
        .b(b),
        .y(ay)
    );
    and2 o0(
        .a(ay),
        .b(c),
        .y(y)
    );

endmodule
