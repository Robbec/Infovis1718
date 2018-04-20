// variabelen voor de DOM-elementen
var body = d3.select("body");
var left = d3.select(".left");
var right = d3.select(".right");
var hypergraphContainer = left.select(".hypergraph-container");
var hypergraph = hypergraphContainer.select(".hypergraph");
var infobox = right.select(".infobox");

// afmetingen van de svg
var svgWidth = 500;
var svgHeight = 500;

// maak een svg voor de hypergraf
hypergraph.attr("width", svgWidth)
.attr("height", svgHeight);

var kulBlue = "#1d8db0";

// tooltip aanmaken (inhoud wordt ingevuld bij hover over bolletje)
var tooltip = hypergraphContainer.append("div")
.classed("tooltip", true);

// kleurenpalet aan opties koppelen
// colors = d3.schemeCategory10;
// var optionColors = {};
// options.forEach((key, idx) => optionColors[key] = colors[idx]);

d3.csv("cw-4.csv").then(function (data) {
  // namen van alle opties
  var columnNames = d3.keys(d3.values(data)[0]);
  var options = columnNames.slice(8, columnNames.length - 1);

  // kleurenpalet aan opties koppelen
  // http://colorbrewer2.org/#type=qualitative&scheme=Paired&n=12
  var colors = ['rgb(178,223,138)','rgb(51,160,44)','rgb(251,154,153)','rgb(227,26,28)','rgb(253,191,111)','rgb(255,127,0)','rgb(202,178,214)','rgb(106,61,154)','rgb(255,255,153)','rgb(177,89,40)', 'rgb(166,206,227)','rgb(31,120,180)'];
  var optionColors = [];
  options.forEach((c, i) => optionColors[c] = colors[i]);

  function getFillColor(d) {
    return kulBlue;
  }

  var links = [];
  var comboNodes = [];

  // maak alle links
  data.forEach(d => {
    // vind de opties waartoe het vak behoort
    var ops = [];
    options.forEach(o => {
      if (d[o] > 0) {
        ops.push(o);
      }
    });

    // als het vak behoort tot 1 optie, maak dan een link tussen het vak en de optie
    if (ops.length == 1) {
      links.push({
        "source": d,
        "target": data.length + options.indexOf(ops[0]),
        "dist": 15
      });
    }

    // het vak behoort tot meerdere opties, maak dan een link tussen het vak en de node voor de overlap
    else if (ops.length > 1) {
      comboName = ops.toString();
      if (!comboNodes.includes(comboName)) {
        comboNodes.push(comboName);
        ops.forEach((o, i) => {
          links.push({
            "source": data.length + options.indexOf(o),
            "target": data.length + options.length + comboNodes.indexOf(comboName),
            "dist": 45
          });
        });
      }
      links.push({
        "source": d,
        "target": data.length + options.length + comboNodes.indexOf(comboName),
        "dist": 45
      });
    }
  });

  var optionNodes = [];
  var optionCombinationNodes = [];
  options.forEach(o => optionNodes.push({ ID: o, OPO: o }));
  comboNodes.forEach(n => optionCombinationNodes.push({ ID: n, OPO: n }));
  var extraNodes = optionNodes.concat(optionCombinationNodes);
  var nodes = data.concat(extraNodes);

  // force simulation bepaalt de positie van alle nodes
  var simulation = d3.forceSimulation(nodes)
  // trek alle nodes naar het centrum van de svg
  .force("center", d3.forceCenter(svgWidth / 2, svgHeight / 2))
  // laat alle nodes elkaar afstoten
  .force("charge", d3.forceManyBody().strength(0))
  // voorkom dat nodes overlappen
  .force("collide", d3.forceCollide(15))
  // duw verbonden elementen uit elkaar
  .force("link", d3.forceLink(links).distance(function (d) {
    return d.dist
  }).strength(2))
  // .force("x", d3.forceX(svgWidth / 2).strength(.08))
  // .force("y", d3.forceY(svgHeight / 2).strength(.08))
  // roep ticked() op in elke iteratiestap van de simulatie
  .on("tick", ticked);

  var lines = hypergraph.selectAll("line")
  .data(links);

  lines.enter()
  .append("line")
  .attr("x1", d => d.source.x)
  .attr("y1", d => d.source.y)
  .attr("x2", d => d.target.x)
  .attr("y2", d => d.target.y)
  .classed("link", true);

  function getOptionClusterColor(d) {
    //default kul-blauw
    var color = getFillColor(d);
    var optionIndex = options.indexOf(d.ID);
    //plichtvakken krijgen kleur van optie
    if (optionIndex != -1) {
      color = optionColors[d.ID];
    }
    return color;
  }

  // bind rechthoeken aan clusterdata
  var optionClusters = hypergraph.selectAll("optionNode")
  .data(optionNodes);

  optionClusters.enter()
  .append("rect")
  .classed("optionNode", true)
  .attr("x", d => d.x)
  .attr("y", d => d.y)
  .attr("width", 10)
  .attr("height", 10)
  .attr("fill", function (d) {
    return getOptionClusterColor(d);
  })
  .on("mouseover", function (d) {
    // toon een tooltip voor het gehoverde vak
    tooltip.classed("active", true)
    .text(d.OPO)
    .style("left", (d.x + 20) + "px")
    .style("top", (d.y - 12) + "px");
  })
  .on("mouseout", function (d) {
    // verberg de tooltip voor het vak waarover gehoverd werd
    tooltip.classed("active", false);
  });

  function getOptionCombinationClusterColor(d) {
    //default kul-blauw
    var color = getFillColor(d);
    var optionIndex = options.indexOf(d.ID);
    //plichtvakken krijgen kleur van optie
    if (optionIndex != -1) {
      color = optionColors[d.ID];
    }
    return color;
  }

  // bind rechthoeken aan clusterdata
  var optionCombinationClusters = hypergraph.selectAll("optionCombinationNode")
  .data(optionCombinationNodes);

  optionCombinationClusters.enter()
  .append("rect")
  .classed("optionNode", true)
  .attr("x", d => d.x)
  .attr("y", d => d.y)
  .attr("height", 10)
  .attr("width", 20)
  .attr("fill", function (d) {
    return getOptionCombinationClusterColor(d);
  })
  .on("mouseover", function (d) {
    // toon een tooltip voor het gehoverde vak
    tooltip.classed("active", true)
    .text(d.OPO)
    .style("left", (d.x + 20) + "px")
    .style("top", (d.y - 12) + "px");
  })
  .on("mouseout", function (d) {
    // verberg de tooltip voor het vak waarover gehoverd werd
    tooltip.classed("active", false);
  });

  function colorOfCourse(d) {
    //default kul-blauw
    var color = getFillColor(d);
    i = 0;
    //plichtvakken krijgen kleur van optie
    while (i < options.length && color == kulBlue) {
      if (d[options[i]] == 1) {
        color = optionColors[options[i]];
      }
      i++;
    }
    //enkel om te testen
    // i = 0;
    // while (i < options.length && color == kulBlue) {
    //   if (d[options[i]] == 2) {
    //     color = optionColors[options[i]];
    //   }
    //   i++
    // }
    return color;
  }

  // bind de cirkels in de hypergraph aan de data
  var course = hypergraph.selectAll("circle")
  .data(data);

  course.enter()
  .append("circle")
  .attr("cx", d => d.x)
  .attr("cy", d => d.y)
  .attr("r", 10)
  .classed("verplicht", function (d) {
    for (var i = 0; i < options.length; i++) {
      return d[options[i]] == 1;
    }
  })
  .classed("keuze", function (d) {
    for (var i = 0; i < options.length; i++) {
      return d[options[i]] == 2;
    }
  })
  .attr("fill", function (d) {
    return getFillColor(d);
  })
  .attr("stroke", function (d) {
    return colorOfCourse(d);
  })
  .on("mouseover", function (d) {
    // toon een tooltip voor het gehoverde vak
    tooltip.classed("active", true)
    .text(d.OPO)
    .style("left", (d.x + 20) + "px")
    .style("top", (d.y - 12) + "px");
  })
  .on("mouseout", function (d) {
    // verberg de tooltip voor het vak waarover gehoverd werd
    tooltip.classed("active", false);
  })
  .on("click", function (d) {
    var thisCourse = d3.select(this);

    // verklein de straal van het actieve vak
    var activeCourse = d3.select("circle.active");
    activeCourse.attr("r", function () {
      return activeCourse.attr("r") / 1.75;
    });

    // zet het actieve vak op non-actief
    d3.selectAll("circle").classed("active", false);

    // verwijder alle inhoud in de infobox
    infobox.select("p").remove();
    infobox.select("h3").remove();
    infobox.select(".points").remove();
    infobox.select(".checkbox-interested").remove();
    infobox.select(".checkbox-chosen-master1").remove();
    infobox.select(".checkbox-chosen-master2").remove();

    // activeer het geselecteerde vak
    thisCourse.classed("active", true)
    .attr("r", function () {
      return thisCourse.attr("r") * 1.75;
    });

    // geef de klasse .prerequisite alleen aan de prerequisites van het actieve vak
    d3.selectAll("circle")
    .classed("prerequisite", function (dcircle) {
      var id = dcircle.ID;
      return d["Gelijktijdig volgen"].split(" ").includes(id);
    });

    // maak nieuwe inhoud aan in de infobox:
    // 1) titel van het actieve vak
    infobox.append("h3").text(d.OPO);

    // 2) studiepunten van het actieve vak
    infobox.append("div")
    .attr("class", "points")
    .text(d.Studiepunten + " SP");

    // 3) checkbox "Niet geïnteresseerd" voor het actieve vak
    var checkboxInterested = infobox.append("label")
    .text("Niet geïnteresseerd in dit vak.");
    checkboxInterested.attr("class", "checkbox checkbox-interested")
    .append("input")
    .attr("type", "checkbox")
    .property("checked", thisCourse.classed("not-interested"))
    .property("checked", thisCourse.classed("is-not-interested"));
    checkboxInterested.append("span")
    .attr("class", "checkmark");

    // 4) checkbox "Kies in 1ste Master" voor het actieve vak
    var checkboxChoose1 = infobox.append("label")
    .text("Kies dit vak in 1ste Master.");
    checkboxChoose1.attr("class", "checkbox checkbox-chosen-master1")
    .append("input")
    .attr("type", "checkbox")
    .property("checked", thisCourse.classed("chosen-master1"));
    checkboxChoose1.append("span")
    .attr("class", "checkmark");

    // 5) checkbox "Kies in 2de Master" voor het actieve vak
    var checkboxChoose2 = infobox.append("label")
    .text("Kies dit vak in 2de Master.");
    checkboxChoose2.attr("class", "checkbox checkbox-chosen-master2")
    .append("input")
    .attr("type", "checkbox")
    .property("checked", thisCourse.classed("chosen-master2"));
    checkboxChoose2.append("span")
    .attr("class", "checkmark");
  });


  // this function is called each time the hypergraph force simulation iterates
  function ticked() {
    //
    hypergraph.selectAll("line")
    .data(links)
    .attr("x1", d => d.source.x)
    .attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x)
    .attr("y2", d => d.target.y);

    // position the circles for the courses
    hypergraph.selectAll("circle")
    .data(data)
    .attr("cx", d => d.x)
    .attr("cy", d => d.y);

    hypergraph.selectAll("rect")
    .data(extraNodes)
    .attr("x", d => d.x - 10/2)
    .attr("y", d => d.y - 10/2);

  }

});

// waarde van de switch die vakken al dan niet verbergt waarin de gebruiker niet geïnteresseerd is
var switchInterested = right.select(".switch-interested").select("input");

// creëer variabelen voor de checkboxen (de default waarde mag niet "infobox" zijn)
var checkboxInterested = body;
var checkboxChosenMaster1 = body;
var checkboxChosenMaster2 = body;

infobox.on("change", function () {
  // controleer of de checkbox "Niet geïnteresseerd" van status verandert
  var checkboxInterestedNew = infobox.select(".checkbox-interested").select("input");
  if (checkboxInterested !== checkboxInterestedNew) {
    checkboxInterested = checkboxInterestedNew;
    checkboxInterestedChanged();
  }

  // controleer of de checkbox "Kies in 1ste Master" van status verandert
  var checkboxChosenMaster1New = infobox.select(".checkbox-chosen-master1").select("input");
  if (checkboxChosenMaster1 !== checkboxChosenMaster1New) {
    checkboxChosenMaster1 = checkboxChosenMaster1New;
    checkboxChosenMaster1Changed();
  }

  // controleer of de checkbox "Kies in 2de Master" van status verandert
  var checkboxChosenMaster2New = infobox.select(".checkbox-chosen-master2").select("input");
  if (checkboxChosenMaster2 !== checkboxChosenMaster2New) {
    checkboxChosenMaster2 = checkboxChosenMaster2New;
    checkboxChosenMaster2Changed();
  }
});

// verander de klassen m.b.t. interesse voor het actieve vak
function checkboxInterestedChanged() {
  var switchInterestedChecked = switchInterested.property("checked");
  var activeCourse = d3.select("circle.active");
  var checked = checkboxInterested.property("checked");

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
};

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

// verander de klassen m.b.t. 1ste Master voor het actieve vak
function checkboxChosenMaster1Changed() {
  var activeCourse = d3.select("circle.active");
  var checked = checkboxChosenMaster1.property("checked");

  // voeg de klasse .chosen-master1 toe aan het actieve vak als het gemarkeerd is als "Gekozen in 1ste Master"
  activeCourse.classed("chosen-master1", function () {
    return checked;
  });
};

// verander de klassen m.b.t. 2de Master voor het actieve vak
function checkboxChosenMaster2Changed() {
  var activeCourse = d3.select("circle.active");
  var checked = checkboxChosenMaster2.property("checked");

  // voeg de klasse .chosen-master2 toe aan het actieve vak als het gemarkeerd is als "Gekozen in 2de Master"
  activeCourse.classed("chosen-master2", function () {
    return checked;
  });
};
