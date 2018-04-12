var hypergraph = d3.select("#hypergraph");
var infobox = d3.select("#infobox");
var svg = hypergraph.append("svg");
var width = 500;
var height = 500;
svg.attr("width", width)
.attr("height", height);

// tooltip aanmaken (opacity en inhoud wordt gezet bij hover over bolletje)
// var tt = hypergraph.append("div")
// .attr("class", "tooltip")
// .style("opacity", 0);

// voorlopig enkel de 6 opties (gebruikt voor indexering)
var options = ["Artificiele intelligentie", "Computationele informatica", "Gedistribueerde systemen", "Mens-machine communicatie", "Software engineering", "Veilige software", "Verdere optie", "Masterproef", "AVO"];

// kleurenpalet aan opties koppelen
colors = d3.schemeCategory10;
var optionColors = {};
options.forEach((key, idx) => optionColors[key] = colors[idx]);

function colorOfCourse(d) {
  // als het vak bij een optie hoort, dan krijgt het de kleur van die optie
  for (var i = 0; i < options.length; i++) {
    if (d[options[i]] != 0) {
      return optionColors[options[i]];
    }
  }
  return "#000000"; // anders default zwart
}

d3.csv("cw-1.csv").then(function (data) {
  
  // berekenen van positie is nog werk aan (moet uiteindelijk toch cluster)
  for (var i = 0; i < data.length; i++) {
    data[i].cx = 25 + (i * 50) % (width - 50);
    data[i].cy = 25 + Math.floor((50 + i * 50) / (width - 50)) * 50;
  }
  
  console.log(data);
  
  var circle = svg.selectAll("circle")
  .data(data);
  
  circle.enter().append("circle")
  .attr("r", 10)
  .attr("cx", d => d.cx)
  .attr("cy", d => d.cy)
  .classed("verplicht", function (d) {
    for (var i = 0; i < options.length; i++) {
    // TODO Pas dit aan.
      return d[options[i]] == 1;
    }
  })
  .classed("keuze", function (d) {
    for (var i = 0; i < options.length; i++) {
    // TODO Pas dit aan.
      return d[options[i]] == 2;
    }
  })
  .attr("fill", function (d) {
    return colorOfCourse(d);
  })  
  .attr("stroke", function (d) {
    return colorOfCourse(d);
  })   
  //tooltip bij mouse over
  .on("mouseover", function (d) {
    infobox.append("h3").text(d.OPO);
    infobox.append("div")
    .attr("class", "points")
    .text(d.Studiepunten + " SP");
    // tt.transition()
    // .duration(200)
    // .style("opacity", .9);
    // tt.html(d.OPO) // inhoud van tooltip kan nog uitgebreid worden
    // .style("left", (d3.event.pageX) + "px")
    // .style("top", (d3.event.pageY - 28) + "px");
  })
  .on("mouseout", function (d) {
    d3.select("#infobox h3").remove();
    d3.select(".points").remove();
    // tt.transition()
    // .duration(500)
    // .style("opacity", 0);
  })
  .on("click", function(d) {
    d3.selectAll("circle").classed("active", false);
    d3.select(this).classed("active", true);
  });
});