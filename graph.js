var body = d3.select("body");
var svg = body.append("svg");
var width = 960;
var height = 600;
svg.attr("width", width)
    .attr("height", height);

// tooltip aanmaken (opacity en inhoud wordt gezet bij hover over bolletje)
var tt = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// voorlopig enkel de 6 opties (gebruikt voor indexering)
var opties = ["Artificiele intelligentie", "Computationele informatica", "Gedistribueerde systemen", "Mens-machine communicatie", "Software engineering", "Veilige software"];

// kleurenpalet aan opties koppelen
colors = d3.schemeCategory10;
var optionColors = {};
opties.forEach((key, idx) => optionColors[key] = colors[idx]);


d3.csv("cw-1.csv").then(function (data) {

    // berekenen van positie is nog werk aan (moet uiteindelijk toch cluster)
    for (var i = 0; i < data.length; i++) {
        data[i].cx = 25 + (i * 50) % (width - 50);
        data[i].cy = 25 + Math.floor((50 + i * 50) / (width - 50)) * 50;
    }

    console.log(data);
    drawCircles(data, svg);

});

// tekend de cirkels
function drawCircles(data, svg) {
    var c = svg.selectAll("course")
        .data(data)
        .enter().append("circle")
        .attr("r", 15)
        .attr("cx", d => d.cx)
        .attr("cy", d => d.cy)
        .attr("stroke-width", 3)
        .attr("fill", function (d) {
            for (var i = 0; i < opties.length; i++) {
                if (d[opties[i]] == 1) {
                    // kijkt of het bij een optie hoort en kleurt de cirkel
                    return optionColors[opties[i]];
                }
            }
            return "#000000"; // anders default zwart
        })
        .attr("stroke", function (d) {
            for (var i = 0; i < opties.length; i++) {
                if (d[opties[i]] == 2) {
                    // kijkt of het vrijwillig bij optie hoort en kleurt rand
                    return optionColors[opties[i]];
                }
            }
            return "#000000"; // anders default zwart
        })
        //tooltip bij mouse over
        .on("mouseover", function (d) {
            tt.transition()
                .duration(200)
                .style("opacity", .9);
            tt.html(d.OPO) // inhoud van tooltip kan nog uitgebreid worden
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function (d) {
            tt.transition()
                .duration(500)
                .style("opacity", 0);
        })
}