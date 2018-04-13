var hypergraph = d3.select("#hypergraph");
var hypergraphSvg = hypergraph.append("div")
.classed("hypergraph-svg", true);
var infobox = d3.select("#infobox");
var svg = hypergraphSvg.append("svg");
var width = 500;
var height = 500;
svg.attr("width", width)
.attr("height", height);

// tooltip aanmaken (inhoud wordt ingevuld bij hover over bolletje)
var tooltip = hypergraphSvg.append("div")
.classed("tooltip", true);

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

d3.csv("cw-2.csv").then(function (data) {
  console.log(data);
  
  // initialiseer de waarden voor "Geïnteresseerd"
  for (var i = 0; i < data.length; i++) {
    data[i].geinteresseerd = 1;
  }
  
  // berekenen van positie is nog werk aan (moet uiteindelijk toch cluster)
  for (var i = 0; i < data.length; i++) {
    data[i].cx = 25 + (i * 50) % (width - 50);
    data[i].cy = 25 + Math.floor((50 + i * 50) / (width - 50)) * 50;
  }
  
  var course = svg.selectAll("circle")
  .data(data);
  
  course.enter()
  .append("circle")
  .attr("cx", d => d.cx)
  .attr("cy", d => d.cy)
  .attr("r", 10)
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
    tooltip.classed("active", true)
    .text(d.OPO) // inhoud van tooltip kan nog uitgebreid worden
    .style("left", (d.cx + 20) + "px")
    .style("top", (d.cy - 12) + "px");
  })
  .on("mouseout", function (d) {
    tooltip.classed("active", false);
  })
  .on("click", function(d) {    
    // set all active courses to non-active
    d3.selectAll("circle").classed("active", false);
    d3.select("#infobox h3").remove();
    d3.select(".points").remove();
    d3.select(".checkbox-container").remove();
    
    // activate the selected course
    d3.select(this).classed("active", true);
    infobox.append("h3").text(d.OPO);
    infobox.append("div")
    .attr("class", "points")
    .text(d.Studiepunten + " SP");
    var checkbox = infobox.append("label")
    .text("Niet geïnteresseerd in dit vak");
    checkbox.attr("class","checkbox-container")
    .append("input")
    .attr("type", "checkbox");
    checkbox.append("span")
    .attr("class", "checkmark");
  });
  
  // TODO De bedoeling is het veld "Geïnteresseerd" van het actieve vak op 0 te zetten en de bijhorende cirkel te verbergen door er een klasse aan te geven. Dit werkt nog niet.
  console.log(d3.selectAll("input"));
  d3.selectAll("input").on("change", function () {
    d3.select("circle.active").classed("not-interested", function () {
      this.checked;
    });
  });
});