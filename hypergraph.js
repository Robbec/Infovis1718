var left = d3.select(".left");
var right = d3.select(".right");
var hypergraph = left.select(".hypergraph");
var infobox = right.select(".infobox");

// maak een svg voor de hypergraph
var svg = hypergraph.append("svg");
var width = 500;
var height = 500;
svg.attr("width", width)
.attr("height", height);

// tooltip aanmaken (inhoud wordt ingevuld bij hover over bolletje)
var tooltip = hypergraph.append("div")
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
  
  // berekenen van positie is nog werk aan (moet uiteindelijk toch cluster)
  for (var i = 0; i < data.length; i++) {
    data[i].cx = 25 + (i * 50) % (width - 50);
    data[i].cy = 25 + Math.floor((50 + i * 50) / (width - 50)) * 50;
  }
  
  // bind de cirkels in de svg aan de data
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
  .on("mouseover", function (d) {
    // toon een tooltip voor het gehoverde vak
    tooltip.classed("active", true)
    .text(d.OPO)
    .style("left", (d.cx + 20) + "px")
    .style("top", (d.cy - 12) + "px");
  })
  .on("mouseout", function (d) {
    // verberg de tooltip voor het vak waarover gehoverd werd
    tooltip.classed("active", false);
  })
  .on("click", function(d) {
    var thisCourse = d3.select(this);
    
    // verklein de straal van het actieve vak
    var activeCourse = d3.select("circle.active");
    activeCourse.attr("r", function () {
      return activeCourse.attr("r") / 1.35;
    });
    
    // zet het actieve vak op non-actief
    d3.selectAll("circle").classed("active", false);
    
    // verwijder alle inhoud in de infobox
    infobox.select("h3").remove();
    d3.select(".points").remove();
    d3.select(".checkbox-interested").remove();
    
    // activeer het geselecteerde vak
    thisCourse.classed("active", true)
    .attr("r", function () {
      return thisCourse.attr("r") * 1.35;
    });
    
    // maak nieuwe inhoud aan in de infobox:
    // 1) titel van het actieve vak
    infobox.append("h3").text(d.OPO);
    // 2) studiepunten van het actieve vak
    infobox.append("div")
    .attr("class", "points")
    .text(d.Studiepunten + " SP");
    // 3) checkbox "Niet geïnteresseerd" voor het actieve vak
    var checkbox = infobox.append("label")
    .text("Niet geïnteresseerd in dit vak.");
    checkbox.attr("class","checkbox-interested")
    .append("input")
    .attr("type", "checkbox")
    .property("checked", thisCourse.classed("not-interested"))
    .property("checked", thisCourse.classed("is-not-interested"));
    checkbox.append("span")
    .attr("class", "checkmark");
  });
});

// waarde van de switch die vakken al dan niet verbergt waarin de gebruiker niet geïnteresseerd is
var switchInterested = right.select(".switch-interested").select("input");

// verander de klasse van het actieve vak als de checkbox "Niet geïnteresseerd" van status verandert
infobox.on("change", function () {
  var switchInterestedChecked = switchInterested.property("checked");
  var activeCourse = d3.select("circle.active");
  var checked = infobox.select(".checkbox-interested")
  .select("input")
  .property("checked");
  
  // voeg de klasse .is-not-interested toe als een vak gemarkeerd is als "Niet geïnteresseerd" en getoond moet worden in de hypergraph
  if (checked && switchInterestedChecked) {
    activeCourse.classed("is-not-interested", true);
  }
  // voeg de klasse .not-interested toe als een vak gemarkeerd is als "Niet geïnteresseerd" en verborgen moet worden in de hypergraph
  else if (checked && !switchInterestedChecked) {
    activeCourse.classed("not-interested", true);
  }
  // verwijder de klassen .not-interested en .is-not-interested als een vak niet gemarkeerd is als "Niet geïnteresseerd"
  else {
    activeCourse.classed("not-interested", false)
    .classed("is-not-interested", false);
  }
});

// verander de klasse van de vakken waarin de gebruiker niet geïnteresseerd is als de status van de switch verandert
switchInterested.on("change", function () {
  // wijzig de klassen .not-interested naar .is-not-interested als de switch wordt ingeschakeld
  if (switchInterested.property("checked")) {
    d3.selectAll("circle")
    .classed("is-not-interested", function () {
      return d3.select(this).classed("not-interested");
    })
    .classed("not-interested", false);
  }
  // wijzig de klassen .is-not-interested naar .not-interested als de switch wordt uitgeschakeld
  else {
    d3.selectAll("circle")
    .classed("not-interested", function () {
      return d3.select(this).classed("is-not-interested");
    })
    .classed("is-not-interested", false);
  }
});