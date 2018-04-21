// variabelen voor de DOM-elementen
var body = d3.select("body");
var left = d3.select(".left");
var right = d3.select(".right");
var hypergraphContainer = left.select(".hypergraph-container");
var hypergraph = hypergraphContainer.select(".hypergraph");
var infobox = right.select(".infobox");

// globale variabelen voor de opbouw van de hypergraf
var options = [];
var optionNodes = [];
var overlapNodes = [];
var links = [];
var distanceOptionNodeRootNode = 40;
var distanceOptionNodeOverlapNode = 20;
var distanceClusterNodeCourse = 15;

// afmetingen van de svg
var svgWidth = 500;
var svgHeight = 500;

// maak een svg voor de hypergraf
hypergraph.attr("width", svgWidth)
.attr("height", svgHeight);

// tooltip aanmaken (inhoud wordt ingevuld bij hover over bolletje)
var tooltip = hypergraphContainer.append("div")
.classed("tooltip", true);

// kleurenpalet aan opties koppelen
// colors = d3.schemeCategory10;
// var optionColors = {};
// options.forEach((key, idx) => optionColors[key] = colors[idx]);

d3.csv("cw-5.csv").then(function (data) {
    d3.csv("uniekeReserveringen.csv").then(function (scheduleData) {
      // namen van alle opties
      var columnNames = d3.keys(d3.values(data)[0]);
      options = columnNames.slice(8, columnNames.length);

    // kleurenpalet aan opties koppelen
    // http://colorbrewer2.org/#type=qualitative&scheme=Paired&n=12
    var colors = ['rgb(178,223,138)','rgb(51,160,44)','rgb(251,154,153)','rgb(227,26,28)','rgb(253,191,111)','rgb(255,127,0)','rgb(202,178,214)','rgb(106,61,154)','rgb(255,255,153)','rgb(177,89,40)', 'rgb(166,206,227)','rgb(31,120,180)'];
    var optionColors = [];
    options.forEach((c, i) => optionColors[c] = colors[i]);
    var kulBlue = "#1d8db0";

    // kleur voor de opvulling van vakken
    function getFillColor(d) {
      return kulBlue;
    }

    function colorOfCourse(d) {
      //default kul-blauw
      var color = getFillColor(d);
      //plichtvakken krijgen kleur van optie
      for (i = 0; i < options.length && color == kulBlue; i++) {
        if (d[options[i]] == 1) {
          color = optionColors[options[i]];
        }
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

    // kleur voor opties
    function getOptionColor(d) {
      //default kul-blauw
      var color = getFillColor(d);
      var optionIndex = options.indexOf(d.ID);
      //plichtvakken krijgen kleur van optie
      if (optionIndex != -1) {
        color = optionColors[d.ID];
      }
      return color;
    }

    function getOptionColour(d) {
      //default kul-blauw
      var color = getFillColor(d);
      var optionIndex = options.indexOf(d.ID);
      //plichtvakken krijgen kleur van optie
      if (optionIndex != -1) {
        color = optionColors[d.ID];
      }
      return color;
    }

    // maak voor elke optie een node
    options.forEach(o => optionNodes.push({ ID: o, OPO: o }));

    // maak alle links voor de hypergraf
    data.forEach(d => {
      // vind de opties waartoe het vak behoort
      var courseOptions = [];
      optionNodes.forEach(o => {
        if (d[o.ID] > 0) {
          courseOptions.push(o);
        }
      });

      // als het vak behoort tot 1 optie, maak dan een link tussen het vak en de node van die optie
      if (courseOptions.length == 1) {
        links.push({
          "source": d,
          "target": courseOptions[0],
          "dist": distanceClusterNodeCourse
        });
      }

      // als het vak behoort tot meerdere opties, maak dan een link tussen het vak en de node voor de overlap
      else if (courseOptions.length > 1) {
        var overlapName = courseOptions.map(o => o.ID).toString();
        var overlapNode = { ID: overlapName, OPO: overlapName };

        // ga na of de overlap node al voorkomt in de lijst van alle overlap nodes; indien niet, sla hem daarin op
        if (overlapNodes.filter(o => o.ID == overlapName).length == 0) {
          // sla de overlap node op in de lijst van alle overlap nodes
          overlapNodes.push(overlapNode);
          // maak een link tussen de overlap node en alle gerelateerde opties
          courseOptions.forEach(o => links.push({
            "source": o,
            "target": overlapNode,
            "dist": distanceOptionNodeOverlapNode
          }));
        }

        // verbind het vak met de overlap node
        links.push({
          "source": d,
          "target": overlapNodes.filter(o => o.ID == overlapName)[0],
          "dist": distanceClusterNodeCourse
        });
      }
    });

    // maak een root node voor de hypergraf
    var rootNode = {ID: "Master", OPO: "Master"};
    // fixeer de positie van de root node in het middelpunt van de hypergraf
    rootNode.fx = svgWidth / 2;
    rootNode.fy = svgHeight / 2;
    // verbind de root node met alle option nodes
    optionNodes.forEach(o => links.push({
      source: rootNode,
      target: o,
      dist: distanceOptionNodeRootNode
    }));
    optionNodes.push(rootNode);

    var clusterNodes = optionNodes.concat(overlapNodes);
    var nodes = data.concat(clusterNodes);

    // force simulation bepaalt de positie van alle nodes
    d3.forceSimulation(nodes)
    // trek alle nodes naar het centrum van de svg
    // .force("center", d3.forceCenter(svgWidth / 2, svgHeight / 2))
    // laat alle nodes elkaar afstoten
    .force("charge", d3.forceManyBody().strength(-40).distanceMin(15).distanceMax(500))
    // voorkom dat nodes overlappen
    .force("collide", d3.forceCollide(15))
    // duw verbonden elementen uit elkaar
    .force("link", d3.forceLink(links).strength(1))
    // .force("link", d3.forceLink(links).distance(d => d.dist).strength(1))
    // .force("x", d3.forceX(svgWidth / 2).strength(.08))
    // .force("y", d3.forceY(svgHeight / 2).strength(.08))
    // roep ticked() op in elke iteratiestap van de simulatie
    .on("tick", ticked);

    d3.forceSimulation(optionNodes)
    // laat option nodes elkaar sterk afstoten
    .force("charge", d3.forceManyBody().strength(-1000).distanceMin(50).distanceMax(400))
    // laat option nodes zich in een cirkel rond het middelpunt van de hypergraf verdelen
    .force("radial", d3.forceRadial(50, svgWidth / 2, svgHeight / 2).strength(1));

    // deze functie wordt opgeroepen in elke iteratiestap van de simulatie
    function ticked() {
      // pas de positie voor de eindpunten van links aan
      hypergraph.selectAll("line")
      .data(links)
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

      // pas de positie aan van de cirkels voor vakken
      hypergraph.selectAll("circle")
      .data(data)
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);

      // pas de positie aan van de rechthoeken
      hypergraph.selectAll("rect")
      .data(clusterNodes)
      .attr("x", d => d.x - 5)
      .attr("y", d => d.y - 5);
    }

    // bind de lijnen aan de links
    var lines = hypergraph.selectAll("line")
    .data(links);

    // construeer de lijnen in de hypergraf
    lines.enter()
    .append("line")
    .attr("x1", d => d.source.x)
    .attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x)
    .attr("y2", d => d.target.y)
    .classed("link", true);

    // maak vierkanten voor de option nodes in de hypergraf
    hypergraph.selectAll(".optionNode")
    .data(optionNodes)
    .enter().append("rect")
    .classed("optionNode", true)
    .attr("x", d => d.x)
    .attr("y", d => d.y)
    .attr("width", 15)
    .attr("height", 15)
    .attr("fill", function (d) {
      return getOptionColor(d);
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

    // maak vierkanten voor de overlap nodes in de hypergraf
    hypergraph.selectAll(".overlapNode")
    .data(overlapNodes)
    .enter().append("rect")
    .classed("overlapNode", true)
    .attr("x", d => d.x)
    .attr("y", d => d.y)
    .attr("height", 10)
    .attr("width", 10)
    .attr("fill", function (d) {
      return getOptionColour(d);
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

    // code: code uit ects-fiche
    // geeft set van overlappende vakken terug
    function getOverlappingCourses(code) {
      // filter alle reservaties horende bij de code
      var codeReservations = scheduleData.filter(reservation => reservation.Code == code);
      overlappingCourseCodes = new Set();
      // voor elke reservatie horende bij de code
      codeReservations.forEach(function(codeReservation) {
        // filter de overlappende reservaties
        var overlappingReservations = scheduleData.filter(function(reservation) {
          // var hourParser = d3.timeParser(%H:%M:%S);
          // var startReservation = hourParser(reservation.Aanvang);
          // var endReservation = hourParser(reservation.Einde);
          // var startCodeReservation = hourParser(codeReservation.Aanvang);
          // var endCodeReservation = hourParser(codeReservation.Einde);

          // zelfde semester
          return reservation.Semester == codeReservation.Semester &&
            // zelfde dag
            reservation.Dagnaam == codeReservation.Dagnaam &&
            // uren overlappen https://stackoverflow.com/questions/325933/determine-whether-two-date-ranges-overlap
            //(startReservation <= endCodeReservation && endReservation >= startCodeReservation) &&
            // niet vak zelf
            reservation.Code != code
        });
        // voor elke overlappende reservatie
        overlappingReservations.forEach(function(overlappingReservation) {
          // voeg zijn code toe aan de set
          overlappingCourseCodes.add(overlappingReservation.Code);
        })
      })
      return(overlappingCourseCodes);
    }

    // bind de cirkels in de hypergraf aan de data
    var course = hypergraph.selectAll("circle")
    .data(data);

    // construeer de cirkels in de hypergraf
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

      // geef de klasse .overlap alleen aan vakken die overlappen met het actieve vak
      d3.selectAll("circle")
      .classed("overlap", function(dcircle) {
        var id = dcircle.ID;
        return getOverlappingCourses(d["ID"]).has(id);
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
