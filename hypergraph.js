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
var distanceOptionRoot = 60;
var distanceOptionCourse = 30;
var courseRadius = 10;
var optionRadius = courseRadius / 1.5;
var transition = d3.transition()
  .duration(750)
  .ease(d3.easeLinear);
var timeout;

// afmetingen van de svg
var svgWidth = 500;
var svgHeight = 500;

// variabelen voor horizontal bar chart
var x = d3.scaleLinear()
  .rangeRound([svgWidth, 0]);
var refreshBars;

// maak een svg voor de hypergraf
hypergraph.attr("width", svgWidth)
  .attr("height", svgHeight);

// tooltip aanmaken (inhoud wordt ingevuld bij hover over bolletje)
var tooltip = hypergraphContainer.append("div")
  .classed("tooltip", true);

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
      dist: distanceOptionRoot
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
            "dist": distanceOptionCourse
          }));
      }
    });

    var nodes = data.concat(optionNodes);

    // force simulation bepaalt de positie van alle nodes
    var simulationNodes = d3.forceSimulation(nodes)
      // laat alle nodes elkaar afstoten
      .force("charge", d3.forceManyBody()
        .distanceMin(15)
        .distanceMax(700)
        .strength(-40)
      )
      // voorkom dat nodes overlappen
      .force("collide", d3.forceCollide(15).strength(1))
      // duw verbonden elementen uit elkaar
      .force("link", d3.forceLink(links)
        // .distance(d => d.dist)
        // .strength(1)
      )
      // roep ticked() op in elke iteratiestap van de simulatie
      .on("tick", ticked);

    var simulationOptionNodes = d3.forceSimulation(optionNodes)
      // laat option nodes elkaar sterk afstoten
      .force("charge", d3.forceManyBody()
        .strength(-1000)
        .distanceMin(50)
        .distanceMax(400)
      )
      // laat option nodes zich in een cirkel rond het middelpunt van de hypergraf verdelen
      .force("radial", d3.forceRadial(75, svgWidth / 2, svgHeight / 2)
        .strength(1)
      );

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
        var a = optionRadius / l;
        var b = (courseRadius + 2.5) / l;
        var x1Offset = a * dx;
        var y1Offset = a * dy;
        var x2Offset = b * dx;
        var y2Offset = b * dy;
        line.attr("x1", d => d.source.x)// - x2Offset)
        line.attr("y1", d => d.source.y)// - y2Offset)
        line.attr("x2", d =>
          (d.source.ID != "Master") ? d.target.x + x2Offset : d.target.x
        )
        line.attr("y2", d =>
          (d.source.ID != "Master") ? d.target.y + y2Offset : d.target.y
        );
      })

      // pas de positie aan van de course nodes
      hypergraph.selectAll(".course-node")
        .data(data)
        .attr("cx", d => boxBoundedX(d.x))
        .attr("cy", d => boxBoundedY(d.y));

      // pas de positie aan van de option nodes
      hypergraph.selectAll(".option-node")
        .data(optionNodes)
        .attr("cx", d => boxBoundedX(d.x))
        .attr("cy", d => boxBoundedY(d.y));
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

    // maak nodes voor de opties in de hypergraf
    hypergraph.selectAll(".option-node")
      .data(optionNodes)
      .enter().append("circle")
      .classed("node option-node", true)
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("r", optionRadius)
      .attr("fill", function (d) {
        return getOptionColour(d);
      })
      .on("mouseover", function (d) {
        showTooltip(d);
        if (!activatedNodeExists()) {
          toggleHighlightOption(d);
        }
      })
      .on("mouseout", function (d) {
        hideTooltip();
        if (!activatedNodeExists()) {
          toggleHighlightOption(d);
        }
      })
      .on("click", function (d) {
        if (isActive(d3.select(this))) {
          emptyInfobox();
          toggleActive(d3.select(this));
          // opmerking: de optie blijft gehighlightet tot de mouseout
        } else if (!activatedNodeExists()) {
          fillInfoboxForOption(d);
          toggleActive(d3.select(this));
          // opmerking: de optie is al gehighlightet vanwege de hover
        }
      });

    // bind de cirkels in de hypergraf aan de data
    var course = hypergraph.selectAll(".course-node")
      .data(data);

    // construeer de nodes voor de vakken in de hypergraf
    course.enter()
      .append("circle")
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("r", courseRadius)
      .classed("node course-node", true)
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
          toggleHighlightConnectedOptions(d);
          toggleCourseLinksHighlight(d);
          toggleHighlightPrerequisites(d);
        }
      })
      .on("mouseout", function (d) {
        hideTooltip();
        if (!activatedNodeExists()) {
          toggleHighlightConnectedOptions(d);
          toggleCourseLinksHighlight(d);
          toggleHighlightPrerequisites(d);
        }
      })
      .on("click", function (d) {
        // verklein de straal van het vorige actieve vak
        var oldActiveCourse = hypergraph.select(".course-node.active");
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
        hypergraph.selectAll(".course-node")
          .classed("non-active", function (d, i) {
            return !d3.select(this).classed("active") && !alreadyActive;
          }
          );

        // vergroot de straal van het nieuwe actieve vak
        var newActiveCourse = d3.select(".course-node.active");
        newActiveCourse.transition(transition).attr("r", function () {
          return d3.select(this).attr("r") * 1.75;
        });

        toggleHighlightPrerequisites(d);

        // geef de klasse .non-active aan alle option nodes als en slechts als er een vak actief is
        hypergraph.selectAll(".option-node")
          .classed("non-active", !newActiveCourse.empty());

        toggleHighlightConnectedOptions(d);

        // sla alle vakken op die overlappen met het actieve vak
        if (!newActiveCourse.empty()) {
          var scheduleOverlappingCourses = getScheduleOverlappingCourses(newActiveCourse.datum()["ID"]);
        }

        // geef de klasse .schedule-overlap alleen aan vakken die overlappen met het actieve vak
        hypergraph.selectAll(".course-node")
          .classed("schedule-overlap", function (dcircle) {
            var id = dcircle.ID;
            if (!newActiveCourse.empty()) {
              return scheduleOverlappingCourses.has(id);
            }
            return false;
          });

        // verberg de hulptekst in de infobox als en slechts als er geen actief vak is
        infobox.select(".help").classed("hidden", !newActiveCourse.empty());

        // verwijder alle vakgerelateerde inhoud in de infobox
        infobox.selectAll(".infobox > *:not(.help)").remove();

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

    // toggle het highlighten van de gegeven optie
    function toggleHighlightOption(option) {
      toggleHighlightConnectedCourses(option);
      toggleHighlightOtherOptions(option);
      toggleHighlightOptionLinks(option);
    }

    // toggle het highlighten van de vakken die verbonden zijn met de gegeven optie
    function toggleHighlightConnectedCourses(option) {
      hypergraph.selectAll(".course-node")
        .each(function (c) {
          if (c[option.ID] == 0) {
            this.classList.toggle("non-active");
          }
        })
    }

    // toggle de highlight van de links die vertrekken uit de gegeven optie
    function toggleHighlightOptionLinks(option) {
      hypergraph.selectAll(".link")
        .each(function (l) {
          if (l.source == option) {
            this.classList.toggle("non-active");
          }
        });
    }

    // toggle de highlight van alle opties verschillend van de gegeven optie
    function toggleHighlightOtherOptions(option) {
      hypergraph.selectAll(".option-node")
        .each(function (o) {
          if (o.ID != "Master" && o.ID != option.ID) {
            this.classList.toggle("non-active");
          }
        })
    }

    // check of de gegeven node actief is
    function isActive(node) {
      return node.classed("active");
    }

    // verander het actief-zijn van de gegeven node
    function toggleActive(node) {
      var active = node.classed("active");
      node.classed("active", !active);
    }

    // toggle de highlight van alle vakken die geen prerequisite zijn van het gegeven vak
    function toggleHighlightPrerequisites(course) {
      var prerequisites = course["Gelijktijdig volgen"];
      hypergraph.selectAll(".course-node")
        .each(function (c) {
          if (c.ID != course.ID && !prerequisites.split(" ").includes(c.ID)) {
            this.classList.toggle("non-active");
          }
        })
    }

    // toggle de highlight van opties die niet verbonden zijn met het gegeven vak
    function toggleHighlightConnectedOptions(course) {
      hypergraph.selectAll(".option-node")
        .each(function (o) {
          if (course[o.ID] == 0) {
            this.classList.toggle("non-active");
          }
        })
    }

    // geef boolean terug die aangeeft of er actieve nodes zijn in de graf
    function activatedNodeExists() {
      var activeCourseNodes = hypergraph.select(".course-node.active");
      var activeOptionNodes = hypergraph.select(".option-node.active");
      return !activeCourseNodes.empty() || !activeOptionNodes.empty();
    }

    // deactiveer alle option nodes
    function deactivateAllOptionNodes() {
      hypergraph.selectAll(".option-node").classed("active", false);
    }

    // verander de highlightstatus van de links die aankomen in de gegeven course
    function toggleCourseLinksHighlight(course) {
      hypergraph.selectAll(".link")
        .each(function (l) {
          if (l.target == course) {
            this.classList.toggle("non-active");
          }
        });
    }

    // toon een tooltip die na 1s weer verdwijnt voor de gegeven node
    function showTooltip(d) {
      tooltip.classed("active", true)
        .text(d.OPO)
        .style("left", (d.x + 20) + "px")
        .style("top", (d.y - 12) + "px");
      clearTimeout(timeout);
      timeout = setTimeout(function () {
        tooltip.classed("active", false);
      }, 1000);
    }

    // verberg de tooltip
    function hideTooltip() {
      tooltip.classed("active", false);
    }

    /**
    * Functies met betrekking tot de inhoud in de infobox
    */

    // verwijder alle vakgerelateerde inhoud in de infobox
    function emptyInfobox() {
      infobox.select(".help").classed("hidden", false);
      infobox.selectAll(".infobox > *:not(.help)").remove();
    }

    // voeg inhoud over de gegeven optie toe aan de infobox
    function fillInfoboxForOption(o) {
      emptyInfobox();
      infobox.select(".help").classed("hidden", true);
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
    refreshBars = drawHorizontalBar;

    function drawHorizontalBar() {
      var barGroup = d3.select(".bargroup");
      var creditLength = svgWidth / 40;
      var p1 = 0;
      var p2 = 0;
      var space = 3;

      var m1 = d3.selectAll(".chosen-master1").data();
      var m2 = d3.selectAll(".chosen-master2").data();
      x.domain([0, 40]).nice();

      var s1 = m1.filter(c => c.Semester == 1);
      var s2 = m1.filter(c => c.Semester == 2);
      var b1 = m1.filter(c => c.Semester == 3);
      b1.forEach(c => {
        c.Studiepunten = c.Studiepunten / 2;
        s1.push(c);
        s2.push(c);
      });
      var s3 = m2.filter(c => c.Semester == 1);
      var s4 = m2.filter(c => c.Semester == 2);
      var b2 = m2.filter(c => c.Semester == 3);
      b2.forEach(c => {
        c.Studiepunten = c.Studiepunten / 2;
        s3.push(c);
        s4.push(c);
      });

      s1 = s1.sort(function (a, b) { return a.Studiepunten > b.Studiepunten });
      S2 = s2.sort(function (a, b) { return a.Studiepunten > b.Studiepunten });
      s3 = s3.sort(function (a, b) { return a.Studiepunten > b.Studiepunten });
      S4 = s4.sort(function (a, b) { return a.Studiepunten > b.Studiepunten });
      

    }
  });
});

// bound the given x coordinate to the visible part of the hypergraph
function boxBoundedX(x) {
  return Math.max(courseRadius + 2.5, Math.min(svgWidth - courseRadius - 2.5, x));
}

// bound the given y coordinate to the visible part of the hypergraph
function boxBoundedY(y) {
  return Math.max(courseRadius + 2.5, Math.min(svgHeight - courseRadius - 2.5, y));
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
  var activeCourse = hypergraph.select(".course-node.active");
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
    hypergraph.selectAll(".course-node")
      .classed("is-not-interested", function () {
        return d3.select(this).classed("not-interested");
      })
      .classed("not-interested", false);
  }
  // wijzig de klassen .is-not-interested naar .not-interested als de switch wordt uitgeschakeld
  else {
    hypergraph.selectAll(".course-node")
      .classed("not-interested", function () {
        return d3.select(this).classed("is-not-interested");
      })
      .classed("is-not-interested", false);
  }
});

// verander de klassen m.b.t. 1ste Master voor het actieve vak
function checkboxChosenMaster1Changed() {
  var activeCourse = hypergraph.select(".course-node.active");
  var checked = checkboxChosenMaster1.property("checked");

  // voeg de klasse .chosen-master1 toe aan het actieve vak als het gemarkeerd is als "Gekozen in 1ste Master"
  activeCourse.classed("chosen-master1", function () {
    return checked;
  });
};

// verander de klassen m.b.t. 2de Master voor het actieve vak
function checkboxChosenMaster2Changed() {
  var activeCourse = hypergraph.select(".course-node.active");
  var checked = checkboxChosenMaster2.property("checked");

  // voeg de klasse .chosen-master2 toe aan het actieve vak als het gemarkeerd is als "Gekozen in 2de Master"
  activeCourse.classed("chosen-master2", function () {
    return checked;
  });
};
