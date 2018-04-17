var left = d3.select(".left");
var right = d3.select(".right");
var hypergraphContainer = left.select(".hypergraph-container");
var hypergraph = left.select(".hypergraph");
var infobox = right.select(".infobox");

var width = 500;
var height = 500;
hypergraph.attr("width", width)
.attr("height", height);

// tooltip aanmaken (inhoud wordt ingevuld bij hover over bolletje)
var tooltip = hypergraphContainer.append("div")
.classed("tooltip", true);

// voorlopig enkel de 6 opties (gebruikt voor indexering)
//var options = ["Artificiele intelligentie", "Computationele informatica", "Gedistribueerde systemen", "Mens-machine communicatie", "Software engineering", "Veilige software", "Verdere optie", "Masterproef", "AVO"];





d3.csv("cw-2.csv").then(function (data) {
  var columnNames = Object.keys(d3.values(data)[0]);
  var options = columnNames.slice(8, columnNames.length - 1);

  // kleurenpalet aan opties koppelen
  // Ziet er niet uit, maar Category10 heeft er 1 te weinig en v5 ondersteunt Category20 niet,
  //  later eigen kleurenschema maken
  colors = d3.schemePaired;
  var optionColors = {};
  options.forEach((key, idx) => optionColors[key] = colors[idx]);

  function colorOfCourse(d) {
    //default kul-blauw
    var kulBlue = "#1d8db0"
    var color = kulBlue;
    i = 0;
    //plichtvakken krijgen kleur van optie
    while (i < options.length && color == kulBlue) {
      if (d[options[i]] == 1) {
        color = optionColors[options[i]];
      }
      i++;
    }
    //enkel om te testen
    i = 0;
    while (i < options.length && color == kulBlue) {
      if (d[options[i]] == 2) {
        color = optionColors[options[i]];
      }
      i++
    }
    return color;
  }

  // berekenen van positie is nog werk aan (moet uiteindelijk toch cluster)
  for (var i = 0; i < data.length; i++) {
    data[i].cx = 25 + (i * 50) % (width - 50);
    data[i].cy = 25 + Math.floor((50 + i * 50) / (width - 50)) * 50;
  }

  // bind de cirkels in de hypergraph aan de data
  var course = hypergraph.selectAll("circle")
  .data(data);

  course.enter()
  .append("circle")
  .attr("cx", d => d.cx)
  .attr("cy", d => d.cy)
  .attr("r", 10)
  .attr("class", function (d) {
    var className = "";

    //fase tag
    className += "fase" + d["Fase"];
    className += " ";

    //semester tag
    if (d["Semester"] == 1) {
      className += "term1";
    }
    else if (d["Semester"] == 2) {
      className += "term2";
    }
    else {
      className += "termBoth"
    }
    className += " ";

    //studiepunten tag
    className += "credits" + d["Studiepunten"];
    className += " ";

    //studiepunten project tag
    className += "projectCredits" + d["Project"];
    className += " ";

    //studiepunten project tag
    className += "examCredits" + d["Examen"];
    className += " ";

    var clusterName = "";
    for (var i = 0; i < options.length; i++) {
      var option = options[i];
      //spaties in optie vervangen door underscore omdat classes worden gesplitst op spaties
      var noSpaceOption = option.replace(/\s/g, '_');
      if (d[option] == 1) {
        className += "compulsory" + noSpaceOption;
        className += " ";
        clusterName += "-" + noSpaceOption;
      }
      else if (d[option] == 2) {
        className += "elective" + noSpaceOption;
        className += " ";
        clusterName += "-" + noSpaceOption;
      }
    }
    className += clusterName;
    return className;
  })
  .classed("compulsory", function (d) {
    for (var i = 0; i < options.length; i++) {
      // TODO Pas dit aan.
      return d[options[i]] == 1;
    }
  })
  .classed("elective", function (d) {
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
    checkboxInterested.attr("class","checkbox checkbox-interested")
    .append("input")
    .attr("type", "checkbox")
    .property("checked", thisCourse.classed("not-interested"))
    .property("checked", thisCourse.classed("is-not-interested"));
    checkboxInterested.append("span")
    .attr("class", "checkmark");

    // 4) checkbox "Kies in 1ste Master" voor het actieve vak
    var checkboxChoose1 = infobox.append("label")
    .text("Kies dit vak in 1ste Master.");
    checkboxChoose1.attr("class","checkbox checkbox-chosen-master1")
    .append("input")
    .attr("type", "checkbox")
    .property("checked", thisCourse.classed("chosen-master1"));
    checkboxChoose1.append("span")
    .attr("class", "checkmark");

    // 5) checkbox "Kies in 2de Master" voor het actieve vak
    var checkboxChoose2 = infobox.append("label")
    .text("Kies dit vak in 2de Master.");
    checkboxChoose2.attr("class","checkbox checkbox-chosen-master2")
    .append("input")
    .attr("type", "checkbox")
    .property("checked", thisCourse.classed("chosen-master2"));
    checkboxChoose2.append("span")
    .attr("class", "checkmark");
  });
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
