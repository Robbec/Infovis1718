var body = d3.select("body");
var svg = body.append("svg");
var width = 960;
var height = 600;
svg.attr("width", width)
    .attr("height", height);

var tt = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

var i = 0;
var j = 50;

var opties = ["Artificiele intelligentie", "Computationele informatica", "Gedistribueerde systemen", "Mens-machine communicatie", "Software engineering", "Veilige software"];

colors = d3.schemeCategory10;
var optionColors = {};
opties.forEach((key, idx) => optionColors[key] = colors[idx]);
console.log(optionColors);

d3.csv("cw-1.csv", function (data) {
    console.log(data);
    i += 50;
    if (i > width - 50) {
        i = 50;
        j += 50;
    }
    drawCircle(i, j, data, svg);

});

function drawCircle(x, y, data, svg) {
    var c = svg.append("circle")
        .attr("r", 15)
        .attr("cx", x)
        .attr("cy", y)
        .attr("stroke-width", 3)
        .on("mouseover", function (d) {
            tt.transition()
                .duration(200)
                .style("opacity", .9);
            tt.html(data.OPO)
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function (d) {
            tt.transition()
                .duration(500)
                .style("opacity", 0);
        });
    opties.forEach(function (option) {
        if (data[option] == 1) {
            c.attr("fill", optionColors[option]);
        }
        if (data[option] == 2) {
            c.attr("stroke", optionColors[option]);
        }
    })
}