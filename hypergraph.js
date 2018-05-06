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
var circleRadius = 10;
var transition = d3.transition()
  .duration(750)
  .ease(d3.easeLinear);
var timeout;

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
    options = columnNames.slice(12, columnNames.length);

    /**
    * Kleuren
    */
    // kleurenpalet aan opties koppelen
    // http://colorbrewer2.org/#type=qualitative&scheme=Paired&n=12
    var colors = ['rgb(178,223,138)', 'rgb(51,160,44)', 'rgb(251,154,153)', 'rgb(227,26,28)', 'rgb(253,191,111)', 'rgb(255,127,0)', 'rgb(202,178,214)', 'rgb(106,61,154)', 'rgb(255,255,153)', 'rgb(177,89,40)', 'rgb(166,206,227)', 'rgb(31,120,180)'];
    var optionColors = [];
    options.forEach((c, i) => optionColors[c] = colors[i]);
    var kulBlue = "#1d8db0";

    // kleur voor de opvulling van vakken
    function getFillColor(d) {
      return "#cfd8dc";
    }

    function colorOfCourse(d) {
      // default kleur
      var color = kulBlue;
      // kleur van de optie
      for (i = 0; i < options.length && color == kulBlue; i++) {
        if (d[options[i]] > 0) {
          color = optionColors[options[i]];
        }
      }
      return color;
    }

    // kleur voor opties
    function getOptionColour(d) {
      // default kul-blauw
      var color = getFillColor(d);
      var optionIndex = options.indexOf(d.ID);
      if (optionIndex != -1) {
        color = optionColors[d.ID];
      }
      return color;
    }

    /**
    * Hypergraf
    */
    // maak voor elke optie een node
    options.forEach(o => optionNodes.push({
      ID: o,
      OPO: o
    }));

    // maak een root node voor de hypergraf
    var rootNode = {
      ID: "Master",
      OPO: "Master"
    };
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

    // maak alle links voor de hypergraf
    data.forEach(d => {
      var courseOptions = getCourseOptions(d);

      // als het vak behoort tot 1 optie, maak dan een link tussen het vak en de node van die optie
      // if (courseOptions.length == 1) {
      //   links.push({
      //     "source": courseOptions[0],
      //     "target": d,
      //     "dist": distanceClusterNodeCourse
      //   });
      // }

      // als het vak behoort tot meerdere opties, maak dan een link tussen het vak en de node voor de overlap
      // else if (courseOptions.length == 6) {
      //   links.push({
      //     "source": d,
      //     "target": rootNode,
      //     "dist": distanceClusterNodeCourse
      //   });
      // }
      // else if (courseOptions.length > 1 && courseOptions.length < 6) {
        // else if (courseOptions.length > 1) {
        // var overlapName = courseOptions.map(o => o.ID).toString();
        // var overlapNode = { ID: overlapName, OPO: overlapName };
        //
        // // ga na of de overlap node al voorkomt in de lijst van alle overlap nodes; indien niet, sla hem daarin op
        // if (overlapNodes.filter(o => o.ID == overlapName).length == 0) {
        //   // sla de overlap node op in de lijst van alle overlap nodes
        //   overlapNodes.push(overlapNode);
        //   // maak een link tussen de overlap node en alle gerelateerde opties
        //   courseOptions.forEach(o => links.push({
        //     "source": o,
        //     "target": overlapNode,
        //     "dist": distanceOptionNodeOverlapNode
        //   }));
        // }

      if (courseOptions.length < options.length) {
        // verbind het vak met de overlap node
        courseOptions.forEach(o =>
          links.push({
            "source": o,
            "target": d,
            "dist": distanceClusterNodeCourse
          }));
      }
    });

    var clusterNodes = optionNodes.concat(overlapNodes);
    var nodes = data.concat(clusterNodes);

    // force simulation bepaalt de positie van alle nodes
    var simulationNodes = d3.forceSimulation(nodes)
      // trek alle nodes naar het centrum van de svg
      // .force("center", d3.forceCenter(svgWidth / 2, svgHeight / 2))
      // laat alle nodes elkaar afstoten
      .force("charge", d3.forceManyBody().strength(-40).distanceMin(15).distanceMax(500))
      // voorkom dat nodes overlappen
      .force("collide", d3.forceCollide(15))
      // duw verbonden elementen uit elkaar
      .force("link", d3.forceLink(links))
      // .force("link", d3.forceLink(links).distance(d => d.dist).strength(1))
      // .force("x", d3.forceX(svgWidth / 2).strength(.08))
      // .force("y", d3.forceY(svgHeight / 2).strength(.08))
      // roep ticked() op in elke iteratiestap van de simulatie
      .on("tick", ticked);

    var simulationOptionNodes = d3.forceSimulation(optionNodes)
      // laat option nodes elkaar sterk afstoten
      .force("charge", d3.forceManyBody().strength(-1000).distanceMin(50).distanceMax(400))
      // laat option nodes zich in een cirkel rond het middelpunt van de hypergraf verdelen
      .force("radial", d3.forceRadial(75, svgWidth / 2, svgHeight / 2).strength(1));

    // deze functie wordt opgeroepen in elke iteratiestap van de simulatie
    function ticked() {
      // pas de positie voor de eindpunten van links aan
      var lines = hypergraph.selectAll("line")
        .data(links);

      lines.each(function () {
        line = d3.select(this);
        var dx = line.attr("x1") - line.attr("x2");
        var dy = line.attr("y1") - line.attr("y2");
        var l = Math.sqrt(dx * dx + dy * dy);
        var a = (circleRadius + 2.5) / l;
        var xOffset = a * dx;
        var yOffset = a * dy;
        line.attr("x1", d => d.source.x)// - xOffset)
        line.attr("y1", d => d.source.y)// - yOffset)
        line.attr("x2", d =>
          (d.source.ID != "Master") ? d.target.x + xOffset : d.target.x
        )
        line.attr("y2", d =>
          (d.source.ID != "Master") ? d.target.y + yOffset : d.target.y
        );
      })

      // pas de positie aan van de cirkels voor vakken
      hypergraph.selectAll("circle")
        .data(data)
        .attr("cx", d => boxBoundedX(d.x))
        .attr("cy", d => boxBoundedY(d.y));

      // pas de positie aan van de rechthoeken
      hypergraph.selectAll(".option-node")
        .data(clusterNodes)
        .attr("x", d => boxBoundedX(d.x - 7.5))
        .attr("y", d => boxBoundedY(d.y - 7.5));
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
      .attr("stroke", l => getOptionColour(l.source))
      .classed("non-active", true)
      .classed("link", true);

    // maak vierkanten voor de option nodes in de hypergraf
    hypergraph.selectAll(".option-node")
      .data(optionNodes)
      .enter().append("rect")
      .classed("node", true)
      .classed("option-node", true)
      .classed("cluster-node", true)
      .attr("x", d => d.x)
      .attr("y", d => d.y)
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", function (d) {
        return getOptionColour(d);
      })
      .on("mouseover", function (d) {
        showTooltip(d);
        if (!activatedNodeExists()) {
          deactiveDisconnectedCourses(d);
          deactivateOtherOptionNodes(d);
          toggleOptionLinksHighlight(d);
        }
      })
      .on("mouseout", function (d) {
        // verberg de tooltip voor de option node waarover gehoverd werd
        tooltip.classed("active", false);

        if (!activatedNodeExists()) {
          restoreDefaultGraph();
          toggleOptionLinksHighlight(d);
        }
      })
      .on("click", function (d) {
        if (d3.select(this).classed("active")) {
          restoreDefaultGraph();
          emptyInfobox();
        } else if (!activatedNodeExists()) {
          restoreDefaultGraph();
          // activeer de aangeklikte option node
          d3.select(this).classed("active", true);
          deactiveDisconnectedCourses(d);
          deactivateOtherOptionNodes(d);
          fillInfoboxForOption(d);
        }
      });

    // maak vierkanten voor de overlap nodes in de hypergraf
    // hypergraph.selectAll(".overlap-node")
    // .data(overlapNodes)
    // .enter().append("rect")
    // .classed("overlap-node", true)
    // .classed("cluster-node", true)
    // .attr("x", d => d.x)
    // .attr("y", d => d.y)
    // .attr("height", 10)
    // .attr("width", 10)
    // .attr("fill", function (d) {
    //   return getOptionColour(d);
    // })
    // .on("mouseover", function (d) {
    //   // toon een tooltip voor het gehoverde vak
    //   tooltip.classed("active", true)
    //   .text(d.OPO)
    //   .style("left", (d.x + 20) + "px")
    //   .style("top", (d.y - 12) + "px");
    // })
    // .on("mouseout", function (d) {
    //   // verberg de tooltip voor het vak waarover gehoverd werd
    //   tooltip.classed("active", false);
    // });

    // bind de cirkels in de hypergraf aan de data
    var course = hypergraph.selectAll("circle")
      .data(data);

    // construeer de cirkels in de hypergraf
    course.enter()
      .append("circle")
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("r", circleRadius)
      .classed("node", true)
      .classed("compulsory", function (d) {
        for (var i = 0; i < options.length; i++) {
          if (d[options[i]] == 1) {
            return true;
          }
        }
        return false;
      })
      .classed("optional", function (d) {
        for (var i = 0; i < options.length; i++) {
          if (d[options[i]] == 2) {
            return true;
          }
        }
        return false;
      })
      .attr("fill", function (d) {
        return colorOfCourse(d);
      })
      .attr("stroke", function (d) {
        return colorOfCourse(d);
      })
      .on("mouseover", function (d) {
        showTooltip(d);
        if (!activatedNodeExists()) {
          highlightConnectedOptions(d);
          deactivateAllOtherCourses(d);
          highlightPrerequisites(d);
          toggleCourseLinksHighlight(d);
        }
      })
      .on("mouseout", function (d) {
        // verberg de tooltip voor het vak waarover gehoverd werd
        tooltip.classed("active", false);
        if (!activatedNodeExists()) {
          restoreDefaultGraph();
          toggleCourseLinksHighlight(d);
        }
      })
      .on("click", function (d) {
        // verklein de straal van het vorige actieve vak
        var oldActiveCourse = d3.select("circle.active");
        oldActiveCourse.transition(transition).attr("r", function () {
          return oldActiveCourse.attr("r") / 1.75;
        });

        // geef de klasse .active aan het aangeklikte vak als dat vak nog niet actief was en vice versa
        var clickedCourse = d3.select(this);
        var alreadyActive = clickedCourse.classed("active");
        clickedCourse.classed("active", !alreadyActive);

        // verwijder de klasse .active voor het vorige actieve vak
        oldActiveCourse.classed("active", false);

        // geef de klasse .non-active aan alle niet-actieve vakken als het aangeklikte vak nog niet actief was; verwijder anders de klasse .non-active
        d3.selectAll("circle").classed("non-active", function (d, i) {
          return !d3.select(this).classed("active") && !alreadyActive;
        });

        // vergroot de straal van het nieuwe actieve vak
        var newActiveCourse = d3.select("circle.active");
        newActiveCourse.transition(transition).attr("r", function () {
          return d3.select(this).attr("r") * 1.75;
        });

        highlightPrerequisites(d);

        // geef de klasse .non-active aan alle cluster nodes als en slechts als er een vak actief is
        d3.selectAll(".cluster-node")
          .classed("non-active", !newActiveCourse.empty());

        highlightConnectedOptions(d);

        // sla alle vakken op die overlappen met het actieve vak
        if (!newActiveCourse.empty()) {
          var scheduleOverlappingCourses = getScheduleOverlappingCourses(newActiveCourse.datum()["ID"]);
        }

        // geef de klasse .schedule-overlap alleen aan vakken die overlappen met het actieve vak
        d3.selectAll("circle")
          .classed("schedule-overlap", function (dcircle) {
            var id = dcircle.ID;
            if (!newActiveCourse.empty()) {
              return scheduleOverlappingCourses.has(id);
            }
            return false;
          });

        // verberg de hulptekst in de infobox als en slechts als er geen actief vak is
        infobox.select("p").classed("hidden", !newActiveCourse.empty());

        // verwijder alle vakgerelateerde inhoud in de infobox
        infobox.selectAll("*:not(p)").remove();

        if (!newActiveCourse.empty()) {
          // maak nieuwe inhoud aan in de infobox:
          var activeCourseData = newActiveCourse.datum();
          // 1) titel van het actieve vak
          infobox.append("h3").text(activeCourseData.OPO);

          // 2) studiepunten van het actieve vak
          infobox.append("div")
            .attr("class", "points")
            .text(activeCourseData.Studiepunten + " SP");

          // 3) checkbox "Niet geïnteresseerd" voor het actieve vak
          var checkboxInterested = infobox.append("label")
            .text("Niet geïnteresseerd in dit vak.");
          checkboxInterested.attr("class", "checkbox checkbox-interested")
            .append("input")
            .attr("type", "checkbox")
            .property("checked", newActiveCourse.classed("not-interested"))
            .property("checked", newActiveCourse.classed("is-not-interested"));
          checkboxInterested.append("span")
            .attr("class", "checkmark");

          // 4) checkbox "Kies in 1ste Master" voor het actieve vak
          var checkboxChoose1 = infobox.append("label")
            .text("Kies dit vak in 1ste Master.");
          checkboxChoose1.attr("class", "checkbox checkbox-chosen-master1")
            .append("input")
            .attr("type", "checkbox")
            .property("checked", newActiveCourse.classed("chosen-master1"));
          checkboxChoose1.append("span")
            .attr("class", "checkmark");

          // 5) checkbox "Kies in 2de Master" voor het actieve vak
          var checkboxChoose2 = infobox.append("label")
            .text("Kies dit vak in 2de Master.");
          checkboxChoose2.attr("class", "checkbox checkbox-chosen-master2")
            .append("input")
            .attr("type", "checkbox")
            .property("checked", newActiveCourse.classed("chosen-master2"));
          checkboxChoose2.append("span")
            .attr("class", "checkmark");
        }
      });

    /**
    * Functies met betrekking tot de toestand van nodes in de hypergraf
    */

    // zet alle vakken die niet verbonden zijn met de gegeven optie op nonactief
    function deactiveDisconnectedCourses(option) {
      var disconnectedCourses = d3.selectAll("circle")
        .filter(c => c[option.ID] == 0);
      disconnectedCourses.classed("non-active", true);
    }

    // zet alle andere option nodes op nonactief als de gegeven optie niet de root node is
    function deactivateOtherOptionNodes(option) {
      d3.selectAll(".option-node")
        .classed("non-active", o => option.ID != "Master" && o.ID != option.ID);
    }

    // herstel de oorspronkelijke toestand van alle nodes in de hypergraf
    function restoreDefaultGraph() {
      var nodes = d3.selectAll(".node");
      nodes.classed("active", false);
      nodes.classed("prerequisite", false);
      nodes.classed("non-active", false);
    }

    function deactivateAllOtherCourses(course) {
      d3.selectAll("circle")
        .filter(c => c.ID != course.ID)
        .classed("non-active", true);
    }

    // geef de klasse .prerequisite aan de prerequisites van het gegeven vak
    function highlightPrerequisites(course) {
      var prerequisites = course["Gelijktijdig volgen"];
      d3.selectAll("circle")
        .classed("prerequisite", c => prerequisites.split(" ").includes(c.ID));
    }

    // highlight de bijhorende opties van het gegeven vak
    function highlightConnectedOptions(course) {
      var disconnectedOptionNodes = d3.selectAll(".option-node")
        .filter(o => course[o.ID] == 0);
      disconnectedOptionNodes.classed("non-active", true);
    }

    // geef boolean terug die aangeeft of er actieve nodes zijn in de graf
    function activatedNodeExists() {
      var activeCourseNodes = d3.select("circle.active");
      var activeOptionNodes = d3.select(".option-node.active");
      return !activeCourseNodes.empty() || !activeOptionNodes.empty();
    }

    // deactiveer alle option nodes
    function deactivateAllOptionNodes() {
      d3.selectAll(".option-node").classed("active", false);
    }

    // verander de highlightstatus van de links die aankomen in de gegeven course
    function toggleCourseLinksHighlight(course) {
      d3.selectAll(".link")
        .filter(l => l.target == course)
        .classed("non-active", function() {
          return !d3.select(this).classed("non-active");
        });
    }

    // verander de highlightstatus van de links die vertrekken uit de gegeven optie
    function toggleOptionLinksHighlight(option) {
      d3.selectAll(".link")
        .filter(l => l.source == option)
        .classed("non-active", function() {
          return !d3.select(this).classed("non-active");
        });
    }

    // toon een tooltip die na 1s weer verdwijnt voor de gegeven node
    function showTooltip(d) {
      tooltip.classed("active", true)
        .text(d.OPO)
        .style("left", (d.x + 20) + "px")
        .style("top", (d.y - 12) + "px");
      clearTimeout(timeout);
      timeout = setTimeout(function() {
        d3.select(".tooltip").classed("active", false);
      }, 1000);
    }

    /**
    * Functies met betrekking tot de inhoud in de infobox
    */

    // verwijder alle vakgerelateerde inhoud in de infobox
    function emptyInfobox() {
      infobox.select("p").classed("hidden", false);
      infobox.selectAll("*:not(p)").remove();
    }

    // voeg inhoud over de gegeven optie toe aan de infobox
    function fillInfoboxForOption(o) {
      emptyInfobox();
      infobox.select("p").classed("hidden", true);
      infobox.append("h3").text(o.OPO);
      var ul = infobox.append("ul").classed("coursesList", true);

      // vind alle vakken van de optie en orden ze alfabetisch
      var courses = data.filter(function (d) {
          return (0 < d[o.OPO]) && (getCourseOptions(d).length < options.length);
        })
       .sort(function (a, b) {
          return a.OPO.toLowerCase().localeCompare(b.OPO.toLowerCase());
        });

      // bind li's aan de vakken
      var li = infobox.select(".coursesList")
        .selectAll(li)
        .data(courses);

      li.enter()
        .append("li")
        .text(d => d.OPO)
        .on("mouseover", function (d) {
          deactivateAllOtherCourses(d);
          highlightPrerequisites(d);
        })
        .on("mouseout", function (d) {

        })
        .on("click", function (d) {

        });
    }

    // vind alle option nodes die verbonden zijn met de gegeven course
    function getCourseOptions(course) {
      var courseOptions = [];
      optionNodes.forEach(o => {
        if (course[o.ID] > 0) {
          courseOptions.push(o);
        }
      });
      return courseOptions;
    }

    /**
    * Functies met betrekking tot het uurrooster
    */

    // geeft set van overlappende vakken terug
    function getScheduleOverlappingCourses(code) {
      // filter alle reservaties horende bij de code
      var codeReservations = scheduleData.filter(reservation => reservation.Code == code);
      scheduleOverlappingCourseCodes = new Set();
      // voor elke reservatie horende bij de code
      codeReservations.forEach(function (codeReservation) {
        // filter de overlappende reservaties
        var overlappingReservations = scheduleData.filter(function (reservation) {
          var hourParser = d3.timeParse("%H:%M:%S");
          var startReservation = hourParser(reservation.Aanvang);
          var endReservation = hourParser(reservation.Einde);
          var startCodeReservation = hourParser(codeReservation.Aanvang);
          var endCodeReservation = hourParser(codeReservation.Einde);

          // zelfde semester
          return reservation.Semester == codeReservation.Semester &&
            // zelfde dag
            reservation.Dagnaam == codeReservation.Dagnaam &&
            // uren overlappen https://stackoverflow.com/questions/325933/determine-whether-two-date-ranges-overlap
            (startReservation < endCodeReservation && endReservation > startCodeReservation) &&
            // niet vak zelf
            reservation.Code != code
        });
        // voor elke overlappende reservatie
        overlappingReservations.forEach(function (overlappingReservation) {
          // voeg zijn code toe aan de set
          scheduleOverlappingCourseCodes.add(overlappingReservation.Code);
        })
      })
      return (scheduleOverlappingCourseCodes);
    }

    /**
    * Horizontal bar
    */
    // om te testen
    data[0].selectedInSem = 1;
    data[5].selectedInSem = 1;
    data[8].selectedInSem = 1;
    drawHorizontalBar();

    function drawHorizontalBar() {
      var barGroup = d3.select(".bargroup");
      var creditLength = svgWidth / 40;
      var pointer = 0;

      // eventueel alle courses in de dom afgaan ipv de data
      data.forEach(course => {
        if (course.selectedInSem > 0) {
          // kleur kan nog
          barGroup.append("svg:rect")
            .attr("width", course.Studiepunten * creditLength)
            .attr("height", "20");
            pointer += course.Studiepunten * creditLength;
        }
      });
    }
  });
});

// bound the given x coordinate to the visible part of the hypergraph
function boxBoundedX(x) {
  return Math.max(circleRadius, Math.min(svgWidth - circleRadius, x));
}

// bound the given y coordinate to the visible part of the hypergraph
function boxBoundedY(y) {
  return Math.max(circleRadius, Math.min(svgHeight - circleRadius, y));
}

/**
* Controleer het gedrag van de checkboxes
*/

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
