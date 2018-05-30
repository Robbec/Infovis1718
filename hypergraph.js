/*
OVERZICHT

1. Globale variabelen
2. Kleuren
3. Opbouw van de hypergraf
4. Simulatie voor de hypergraf
5. Algemene functies i.v.m. de hypergraf
6. Interactie met de hypergraf
7. Opbouw van de infobox
8. Interactie met de infobox
9. Switch
10. Uurrooster
11. Opbouw van de barchart
12. Interactie met de barchart
13. visualisatie aantal studiepunten
*/

/**
* 1. Globale variabelen
*/

// variabelen voor de DOM-elementen
var body = d3.select("body");
var left = d3.select(".left");
var right = d3.select(".right");
var hypergraphContainer = body.select(".hypergraph-container");
var hypergraph = hypergraphContainer.select(".hypergraph");
var barchartContainer = body.select(".barchart-container");
var barchart = barchartContainer.select(".barchart");
var switchInterested = body.select(".switch-interested").select("input");
var infobox = body.select(".infobox");
var gauges = body.select(".gauges-svg");
var gaugesContainer = body.select(".gauges");

// globale variabelen voor de opbouw van de hypergraf
var options = [];
var links = [];
var hiddenCourses = [];
var hiddenLinks = [];
var courseRadius = 13;
var courseBandWidth = 5;
var optionRadius = courseRadius / 1.5;
var transition = d3.transition()
  .duration(750)
  .ease(d3.easeLinear);
var timeout;
var optionChosen = false;
var bachelor = null;

// afmetingen van de svg
var svgWidth = 500;
var svgHeight = 500;

// variabelen voor horizontal bar chart
var barSpacing = 3;
var barHeight = 20;
var barRound = 4;
var barchartLeftMargin = 90;
var creditLength = (svgWidth - barchartLeftMargin) / 40;
var x = d3.scaleLinear()
  .domain([0, 40])
  .range([0, svgWidth]);

// variabelen Infobox
var stpSize = optionRadius * 2;

// maak een svg voor de hypergraf
hypergraphContainer.attr("height", svgHeight);
hypergraph.attr("width", svgWidth)
  .attr("height", svgHeight);

// tooltip aanmaken (inhoud wordt ingevuld bij hover over bolletje)
var tooltip = hypergraphContainer.append("div")
  .attr("class", "tooltip");

// switch standaard uitschakelen
switchInterested.property("checked", false);

d3.csv("cw.csv").then(function (data) {
  d3.csv("uniekeReserveringen.csv").then(function (scheduleData) {
    var columnNames = d3.keys(d3.values(data)[0]);
    var indexFirstOption = 13;
    var optionNames = columnNames.slice(indexFirstOption, columnNames.length);
    var indexFirstExtraOption = 9;
    var extraOptionNames = columnNames.slice(indexFirstExtraOption, indexFirstOption);
    var extraOptionGroupNames = extraOptionNames.slice(2, extraOptionNames.length);
    extraOptionGroupNames.unshift("Verplicht");

    var coursesCompulsoryForAllOptions = data
      .filter(d => getCourseOptionsNames(d).length == optionNames.length);
    var extraData = data
      .filter(function (d) {
        var isOptionCourse = false;
        for (i of extraOptionNames) {
          isOptionCourse = isOptionCourse || d[i] != 0;
        }
        return isOptionCourse;
      })
      .concat(coursesCompulsoryForAllOptions);

    /**
    * 2. Kleuren
    */

    var colors = d3.schemeSet2;
    var defaultGray = "#cfd8dc";

    // kleur voor de vakken
    function colorOfCourse(d) {
      var color = defaultGray;
      if (coursesCompulsoryForAllOptions.includes(d)) {
        return color;
      }
      for (i = 0; i < optionNames.length && color == defaultGray; i++) {
        if (d[optionNames[i]] > 0) {
          color = colors[i];
        }
      }
      return color;
    }

    // kleur voor opties
    function getOptionColour(d) {
      var color = defaultGray;
      var optionIndex = optionNames.indexOf(d.ID);
      if (optionIndex != -1) {
        color = colors[optionIndex];
      }
      return color;
    }

    /**
     * 3. Opbouw van de hypergraf
     */

    // maak voor elke optie een node
    optionNames.forEach(function (o) {
      options.push({
        ID: o,
        OPO: o
      })
    });

    // maak een root voor de hypergraf
    var root = {
      ID: "Master",
      OPO: "Master"
    };

    // fixeer de positie van de root node in het middelpunt van de hypergraf
    root.fx = svgWidth / 2;
    root.fy = svgHeight / 2;

    // verbind de root node met alle option nodes
    options.forEach(o => links.push({
      ID: root.ID + o.ID,
      source: root,
      target: o
    }));
    options.push(root);

    // verbind elk vak met zijn bijhorende opties
    data.forEach(function (d) {
      var courseOptions = getCourseOptions(d);
      if (courseOptions.length < optionNames.length) {
        courseOptions.forEach(o =>
          links.push({
            "ID": o.ID + d.ID,
            "source": o,
            "target": d
          }));
      }
    });

    updateLinks();
    updateOptionNodes();
    updateCourseNodes();

    /**
    * 4. Simulatie voor de hypergraf
    */

    // force simulation bepaalt de positie van alle nodes
    var forceCollide = d3.forceCollide(courseRadius + 2).strength(1);

    var hypergraphData = data
      .filter(d => !extraData.includes(d))
      .concat(options);

    var simulationNodes = d3.forceSimulation(hypergraphData)
      // laat alle nodes elkaar afstoten
      .force("charge", d3.forceManyBody()
        .distanceMax(700)
        .strength(function (d) {
          if (d.ID == "Master") {
            return -100;
          } else {
            return -75;
          }
        })
      )
      // voorkom dat nodes overlappen
      .force("collide", forceCollide)
      // duw verbonden elementen uit elkaar
      .force("link", d3.forceLink(links)
        .distance(courseRadius * 4)
        .strength(0.6)
      )
      // roep ticked() op in elke iteratiestap van de simulatie
      .on("tick", ticked);

    // deze functie wordt opgeroepen in elke iteratiestap van de simulatie
    function ticked() {
      // pas de positie aan van de course nodes
      hypergraph.selectAll(".course-node")
        .attr("transform", function (d) {
          if (d.x && d.y) {
            var courseX = boxBoundedX(d.x - courseRadius);
            var courseY = boxBoundedY(d.y - courseRadius);
            return "translate(" + courseX + "," + courseY + ")";
          }
        });

      // pas de positie aan van de option nodes
      hypergraph.selectAll(".option-node")
        .attr("cx", d => boxBoundedX(d.fx || d.x))
        .attr("cy", d => boxBoundedY(d.y));

      // pas de positie voor de eindpunten van links aan
      hypergraph.selectAll(".link").each(function () {
        var line = d3.select(this);
        var dx = line.attr("x2") - line.attr("x1");
        var dy = line.attr("y2") - line.attr("y1");
        var l = Math.sqrt(dx * dx + dy * dy);
        var a = optionRadius / l;
        var b = courseRadius / l;
        var x1Offset = a * dx;
        var y1Offset = a * dy;
        var x2Offset = b * dx;
        var y2Offset = b * dy;
        line.attr("x1", function (d) {
          // if (x1Offset) {
          //   return d.source.x + x1Offset;
          // } else {
          return d.source.x;
          // }
        })
          .attr("y1", function (d) {
            // if (y1Offset) {
            //   return d.source.y + y1Offset;
            // } else {
            return d.source.y;
            // }
          })
          .attr("x2", function (d) {
            if (d.source.ID != "Master") {
              return d.target.x - (x2Offset || 0);
            } else {
              return d.target.x;
            }
          })
          .attr("y2", function (d) {
            if (d.source.ID != "Master") {
              return d.target.y - (y2Offset || 0);
            } else {
              return d.target.y;
            }
          });
      });
    }

    var simulationOptionNodes = d3.forceSimulation(options)
      // laat option nodes elkaar sterk afstoten
      .force("charge", d3.forceManyBody()
        .strength(-500)
      );

    function simulateExtraCourses() {
      var extraCoursesLabelY = 50;
      var extraCoursesSpacing = 30;
      for (name of extraOptionGroupNames) {
        if (extraOptionGroupNames.indexOf(name) == 0) {
          var extra = coursesCompulsoryForAllOptions
            .concat(data.filter(d => d[bachelor] > 0));
        } else {
          var extra = extraData.filter(d => d[name] > 0);
        }

        d3.forceSimulation(extra)
          .force("x", d3.forceX(function (d) {
            return 30 + (extra.indexOf(d) % 7) * 35;
          }))
          .force("y", d3.forceY(function (d) {
            return extraCoursesLabelY + extraCoursesSpacing + Math.floor(extra.indexOf(d) / 7) * 35;
          }));

        extraCoursesLabelY += (Math.ceil(extra.length / 7) * 35 + 2 * extraCoursesSpacing);
      }
    }

    // bound the given x coordinate to the visible part of the hypergraph
    function boxBoundedX(x) {
      return Math.max(courseRadius * 1.5, Math.min(svgWidth - (courseRadius * 3), x));
    }

    // bound the given y coordinate to the visible part of the hypergraph
    function boxBoundedY(y) {
      return Math.max(courseRadius * 1.5, Math.min(svgHeight - (courseRadius * 3), y));
    }

    /**
    * 5. Algemene functies i.v.m. de hypergraf
    */

    // updatepatroon voor de links
    function updateLinks() {
      var link = hypergraph.selectAll("line")
        .data(links, l => l.ID);

      link.enter()
        .append("line")
        .attr("stroke", l => getOptionColour(l.source))
        .classed("link non-active", true);

      link.exit().remove();
    }

    // updatepatroon voor de option nodes
    function updateOptionNodes() {
      var option = hypergraph.selectAll(".option-node")
        .data(options);

      option.enter()
        .append("circle")
        .classed("node option-node", true)
        .attr("r", optionRadius)
        .attr("fill", function (d) {
          return getOptionColour(d);
        })
        .on("mouseover", function (d) {
          showTooltip(d);
          if (!activeNodeExists()) {
            toggleHighlightOption(d);
          }
        })
        .on("mouseout", function (d) {
          hideTooltip();
          if (!activeNodeExists()) {
            toggleHighlightOption(d);
          }
        })
        .on("click", optionClicked);

      option.exit().remove();
    }

    // updatepatroon voor de course nodes
    function updateCourseNodes() {
      var size = 2 * courseRadius;

      var course = hypergraph.selectAll(".course-node")
        .data(data, d => d.ID);

      var courseEnter = course.enter()
        .append("svg")
        .attr("height", size)
        .attr("width", size)
        .classed("node course-node", true)
        .classed("not-interested", switchInterested.property("checked"))
        .classed("extra-course-node", d => extraData.includes(d))
        .style("display", function (d) {
          if (extraData.includes(d) && !optionChosen) {
            return "none";
          }
        })
        .on("mouseover", function (d) {
          showTooltip(d);
          toggleMouseoverCourse(d);
        })
        .on("mouseout", function (d) {
          hideTooltip();
          toggleMouseoverCourse(d);
        })
        .on("click", function () {
          courseClicked(d3.select(this));
        });

      var courseG = courseEnter.append("g")
        .attr("transform", "translate(" + (size / 2) + "," + (size / 2) + ")");

      // pie chart voor elk vak
      courseG.selectAll("course-piece")
        .data(function (d) {
          var nbOptions = optionNames.length;
          var values = d3.values(d)
            .splice(indexFirstOption, nbOptions)
            .map(e => (e > 0) ? 1 : 0);
          // trick: the last integer indicates whether the course should be totally gray
          var sum = d3.sum(values);
          if (sum == nbOptions || sum == 0) {
            values = values.map(d => 0);
            values.push(1);
          }
          return d3.pie()(values);
        })
        .enter()
        .append("path")
        .attr("class", "course-piece")
        .attr("d", function (d) {
          var arc = d3.arc().innerRadius(0).outerRadius(courseRadius);
          return arc(d);
        })
        .attr("fill", (d, i) => (i < optionNames.length) ? colors[i] : defaultGray);

      // extra doorzichtige pie chart die de pie chart voor verplichte vakken afschermt
      courseG.selectAll("course-compulsory-piece")
        .data(function (d) {
          var nbOptions = optionNames.length;
          var values = d3.values(d)
            .splice(indexFirstOption, nbOptions);
          // trick: the last integer indicates whether the course should be totally gray
          var sum = d3.sum(values.map(e => (e > 0) ? 1 : 0));
          if (sum == nbOptions || d[extraOptionNames[0]] > 0 || d[extraOptionNames[1]] > 0) {
            values = values.map(d => 0);
            values.push(1);
          }
          return d3.pie().value(d => (d > 1) ? 1 : d)(values);
        })
        .enter()
        .append("path")
        .classed("course-compulsory-piece", true)
        .classed("compulsory", d => d.data == 1)
        .attr("d", function (d) {
          var arc = d3.arc().innerRadius(0).outerRadius(courseRadius - courseBandWidth);
          return arc(d);
        })
        .attr("fill", (d, i) => (i < optionNames.length) ? colors[i] : defaultGray);

      course.exit().remove();
    }

    function updateHypergraph() {
      updateLinks();
      updateOptionNodes();
      updateCourseNodes();
      simulationNodes.alpha(0.5).restart();
      simulationOptionNodes.alpha(0.5).restart();
      simulateExtraCourses();
    }

    function checkCompulsoryOrOptional(d, n) {
      for (var i = 0; i < optionNames.length; i++) {
        var optionName = optionNames[i];
        if (d[optionName] == n) {
          return true;
        }
      }
      for (var i = 0; i < extraOptionNames.length; i++) {
        var extraName = extraOptionNames[i];
        if (d[extraName] == n) {
          return true;
        }
      }
      return false;
    }

    // vind alle opties die het gegeven vak aanbieden
    function getCourseOptions(course) {
      var courseOptions = [];
      for (o of options) {
        if (course[o.ID] > 0) {
          courseOptions.push(o);
        }
      }
      return courseOptions;
    }

    function getCourseOptionsNames(course) {
      var courseOptions = [];
      for (name of optionNames) {
        if (course[name] > 0) {
          courseOptions.push(name);
        }
      }
      return courseOptions;
    }

    // vind alle vakken voor een optie
    function getOptionCourses(o) {
      return data
        .filter(d => 0 < d[o.OPO])
        .filter(d => !coursesCompulsoryForAllOptions.includes(d));
    }

    // vind alle links die in een course node aankomen
    function getCourseLinks(course) {
      return hypergraph.selectAll(".link")
        .filter(l => l.target == course);
    }

    // check of er actieve nodes zijn in de graf
    function activeNodeExists() {
      var activeNode = hypergraph.select(".active");
      return !activeNode.empty();
    }

    // check of de gegeven node actief is
    function isActive(node) {
      return node.classed("active");
    }

    // toggle het actief-zijn van de gegeven node
    function toggleActive(node) {
      var active = node.classed("active");
      node.classed("active", !active);
    }

    // bepaal voor hoeveel studiepunten een vak mee telt in een semester
    function semestrialPoints(d) {
      return (d.Semester == 3) ? d.Studiepunten / 2 : d.Studiepunten;
    }

    /**
    * 6. Interactie met de hypergraf
    */

    hypergraph.on("click", function () {
      backgroundClicked();
    });

    function backgroundClicked() {
      var activeCourse = hypergraph.select(".course-node.active");
      var activeOption = hypergraph.select(".option-node.active");
      if (!activeCourse.empty()) {
        // resizeCourseNode(activeCourse, 2 / 3);
        toggleHighlightCourse(activeCourse.datum());
        toggleScheduleOverlap(activeCourse);
        toggleActive(activeCourse);
        emptyInfobox();
      } else if (!activeOption.empty()) {
        var o = activeOption.datum();
        toggleHighlightOption(o);
        toggleActive(activeOption);
        emptyInfobox();
        toggleClickabilityOptions(o);
        toggleClickabilityCourses(o);
      }
    }

    function optionClicked() {
      d3.event.stopPropagation();
      var option = d3.select(this);
      var o = option.datum();
      var activeCourse = hypergraph.select(".course-node.active");
      if (isActive(option)) {
        toggleActive(option);
        emptyInfobox();
        toggleClickabilityOptions(o);
        toggleClickabilityCourses(o);
        // opmerking: de optie blijft gehighlightet tot de mouseout
      } else if (!activeCourse.empty()) {
        // resizeCourseNode(activeCourse, 2 / 3);
        toggleHighlightCourse(activeCourse.datum());
        toggleActive(activeCourse);
        toggleActive(option);
        toggleHighlightOption(o);
        toggleScheduleOverlap(activeCourse);
        emptyInfobox();
        fillInfoboxForOption(option);
        toggleClickabilityOptions(o);
        toggleClickabilityCourses(o);
      } else if (hypergraph.select(".option-node.active").empty()) {
        toggleActive(option);
        fillInfoboxForOption(option);
        toggleClickabilityOptions(o);
        toggleClickabilityCourses(o);
        // opmerking: de optie is al gehighlightet vanwege de hover
      }
    }

    function courseClicked(course) {
      d3.event.stopPropagation();
      var activeCourse = hypergraph.select(".course-node.active");
      var activeOption = hypergraph.select(".option-node.active");
      var activeCourseExists = !activeCourse.empty();
      var activeOptionExists = !activeOption.empty();
      var c = course.datum();
      if (activeOptionExists) {
        var ao = activeOption.datum();
      }
      if (isActive(course)) {
        // opmerking: het vak blijft gehighlightet tot de mouseout
        // resizeCourseNode(course, 2 / 3);
        toggleActive(course);
        emptyInfobox();
        toggleScheduleOverlap(course);
      } else if (activeCourseExists) {
        var ac = activeCourse.datum();
        // opmerking: de highlights voor de betrokken vakken moeten nu aangepast worden
        // resizeCourseNode(activeCourse, 2 / 3);
        toggleHighlightCourse(ac);
        toggleActive(activeCourse);
        toggleScheduleOverlap(course);
        // resizeCourseNode(course, 1.5);
        toggleHighlightCourse(c);
        toggleScheduleOverlap(activeCourse);
        toggleActive(course);
        fillInfoboxForCourse(course);
      } else if (activeOptionExists && getOptionCourses(ao).includes(c)) {
        // opmerking: de prerequisites zijn al gehighlightet vanwege de hover
        toggleActive(activeOption);
        // resizeCourseNode(course, 1.5);
        toggleScheduleOverlap(course);
        toggleActive(course);
        fillInfoboxForCourse(course);
        toggleClickabilityOptions(ao);
        toggleClickabilityCourses(ao);
      } else if (!activeNodeExists()) {
        // opmerking: de prerequisites zijn al gehighlightet vanwege de hover
        // resizeCourseNode(course, 1.5);
        toggleScheduleOverlap(course);
        toggleActive(course);
        fillInfoboxForCourse(course);
      }
    }

    function toggleScheduleOverlap(course) {
      if (optionChosen) {
        var scheduleOverlappingCourses = getScheduleOverlappingCourses(course.datum()["ID"]);
        if (scheduleOverlappingCourses.size > 0) {
          body.selectAll(".overlap-warning")
            .each(function () {
              d3.select(".legenda").node().classList.toggle("invisible");
              this.classList.toggle("invisible");
            });
          hypergraph.selectAll(".course-node")
            .filter(c => scheduleOverlappingCourses.has(c.ID))
            .each(function () {
              this.classList.toggle("schedule-overlap");
            })
        }
      }
    }

    // verander de straal van de gegeven course node met de gegeven factor
    // function resizeCourseNode(course, factor) {
    //   forceCollide.radius(function (d, i) {
    //     if (d == course.datum()) {
    //       return courseRadius * factor;
    //     } else {
    //       return courseRadius + 2;
    //     }
    //   });
    //   simulationNodes.alpha(0.05).restart();
    //   simulationOptionNodes.alpha(0.05).restart();
    // }

    // function arcTween(outerRadius, delay) {
    //   return function() {
    //     d3.select(this).transition().delay(delay).attrTween("d", function(d) {
    //       var i = d3.interpolate(d.outerRadius, outerRadius);
    //       return function(t) { d.outerRadius = i(t); return arc(d); };
    //     });
    //   };
    // }

    // bepaal het gedrag bij het hoveren van een vak
    function toggleMouseoverCourse(c) {
      var inActiveOption = false;
      var activeOption = hypergraph.selectAll(".option-node.active");
      var activeOptionExists = !activeOption.empty();
      if (activeOptionExists) {
        var ao = activeOption.datum();
        inActiveOption = getOptionCourses(ao).includes(c);
      }
      if (inActiveOption) {
        toggleHighlightOption(ao);
        toggleHighlightCourse(c);
      } else if (!activeNodeExists()) {
        toggleHighlightCourse(c);
      }
    }

    // toggle de highlight van de gegeven optie
    function toggleHighlightOption(option) {
      toggleHighlightConnectedCourses(option);
      toggleHighlightOptionLinks(option);
      toggleHighlightOtherOptions(option);
    }

    // toggle de highlight van de vakken die verbonden zijn met de gegeven optie
    function toggleHighlightConnectedCourses(o) {
      hypergraph.selectAll(".course-node")
        .filter(c => !getOptionCourses(o).includes(c))
        .each(function () {
          this.classList.toggle("non-active");
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

    // toggle de highlight van het gegeven vak
    function toggleHighlightCourse(course) {
      toggleHighlightConnectedOptions(course);
      toggleHighlightCourseLinks(course);
      toggleHighlightPrerequisites(course);
    }

    // toggle de highlight van de opties die niet verbonden zijn met het gegeven vak
    function toggleHighlightConnectedOptions(course) {
      hypergraph.selectAll(".option-node")
        .each(function (o) {
          if (course[o.ID] == 0) {
            this.classList.toggle("non-active");
          }
        })
    }

    // toggle de highlight van de links die aankomen in het gegeven vak
    function toggleHighlightCourseLinks(course) {
      getCourseLinks(course).each(function () {
        this.classList.toggle("non-active");
      });
    }

    // toggle de highlight van de vakken die geen prerequisite zijn van het gegeven vak
    function toggleHighlightPrerequisites(course) {
      var prerequisites = course["Gelijktijdig volgen"];
      hypergraph.selectAll(".course-node")
        .each(function (c) {
          var isPrerequisite = prerequisites.split(" ").includes(c.ID);
          if (c.ID != course.ID && (!isPrerequisite || !optionChosen)) {
            this.classList.toggle("non-active");
          }
        })
    }

    // toggle de aanklikbaarheid van andere opties
    function toggleClickabilityOptions(o) {
      hypergraph.selectAll(".option-node")
        .each(function (d) {
          if (d != o) {
            this.classList.toggle("not-clickable");
          }
        })
    }

    // toggle de aanklikbaarheid van vakken die niet verbonden zijn met de gegeven optie
    function toggleClickabilityCourses(o) {
      hypergraph.selectAll(".course-node")
        .each(function (d) {
          if (!getOptionCourses(o).includes(d)) {
            this.classList.toggle("not-clickable");
          }
        })
    }

    // toon een tooltip die na 1s weer verdwijnt voor de gegeven node
    function showTooltip(d) {
      tooltip.classed("active", true)
        .text(d.OPO)
        .style("left", (d.x + courseRadius * 1.5) + "px")
        .style("top", (d.y - courseRadius) + "px");
      clearTimeout(timeout);
      timeout = setTimeout(function () {
        tooltip.classed("active", false);
      }, 2000);
    }

    // verberg de tooltip
    function hideTooltip() {
      tooltip.classed("active", false);
    }

    /**
     * 7. Opbouw van de infobox
     */

    infobox.select(".option-number")
      .append("text")
      .text(optionNames.length);

    // verwijder alle vakgerelateerde inhoud in de infobox
    function emptyInfobox() {
      infobox.select(".help").classed("hidden", activeNodeExists());
      infobox.selectAll(".infobox > *:not(.help)").remove();
    }

    // voeg inhoud over de gegeven optie toe aan de infobox
    function fillInfoboxForOption(option) {
      emptyInfobox();
      var o = option.datum();
      infobox.append("h3").text(o.OPO);
      infobox.append("ul").attr("class", "courses-list");
      updateOptionCourses(o);

      // checkbox "Kies optie"
      var optionActive = !hypergraph.select(".option-chosen.active").empty();
      if (!optionChosen || optionActive) {
        var buttons = infobox.append("div")
          .attr("class", "infobox-buttons");
        var checkboxChoose = buttons.append("label")
          .text("Kies deze optie");
        checkboxChoose.attr("class", "radiobutton")
          .append("input")
          .attr("type", "checkbox")
          .property("checked", optionActive);
        checkboxChoose.append("span")
          .attr("class", "checkmark");
        checkboxChoose.on("change", function () {
          toggleOptionChosen();
        });
      }
    }

    function updateOptionCourses(o) {
      // orden alle vakken van de optie alfabetisch
      var courses = getOptionCourses(o)
        .sort(function (a, b) {
          return a.OPO.toLowerCase().localeCompare(b.OPO.toLowerCase());
        });

      var li = infobox.select(".courses-list").selectAll(li)
        .data(courses, d => d.ID);

      var liEnter = li.enter()
        .append("li")
        .text(d => d.OPO)
        .classed("not-interested", function (d) {
          var node = hypergraph.selectAll(".course-node")
            .filter(c => c == d);
          return node.classed("not-interested");
        })
        .on("mouseover", function (d) {
          toggleHighlightOption(o);
          toggleHighlightCourse(d);
        })
        .on("mouseout", function (d) {
          toggleHighlightOption(o);
          toggleHighlightCourse(d);
        })
        .on("click", function (d) {
          var course = hypergraph.selectAll(".course-node")
            .filter(c => c == d);
          courseClicked(course);
        });

      li.exit().remove();

      addSemesterSymbol(o, liEnter);
    }

    function addSemesterSymbol(o, courses) {
      var size = 2 * courseRadius;
      var svg = courses.append("svg")
        .attr("height", size)
        .attr("width", size);

      svg.append("circle")
        .attr("r", courseRadius - (courseBandWidth / 2))
        .attr("cx", size / 2)
        .attr("cy", size / 2)
        .classed("node course-node", true)
        .classed("compulsory", function (d) {
          for (var i = 0; i < optionNames.length; i++) {
            if (d[optionNames[i]] == 1) {
              return true;
            }
          }
          return false;
        })
        .classed("optional", function (d) {
          for (var i = 0; i < optionNames.length; i++) {
            if (d[optionNames[i]] == 2) {
              return true;
            }
          }
          return false;
        })
        .attr("fill", colors[options.indexOf(o)])
        .attr("stroke", colors[options.indexOf(o)]);

      svg.append("rect")
        .attr("class", "semester-rect")
        .attr("height", size)
        .attr("width", size / 2)
        .attr("x", d => (size / 2) * (2 - d.Semester));
    }

    // voeg inhoud voor het gegeven vak toe aan de infobox
    function fillInfoboxForCourse(course) {
      emptyInfobox();
      var c = course.datum();
      var infoboxCourseTitle = infobox.append("div")
        .classed("infoboxCourseTitle", true);
      // titel
      infoboxCourseTitle.append("h3")
        .text(c.OPO)

      if (optionChosen) {
        var courseDetails = infobox.append("div")
          .attr("class", "course-details");

        var size = 2 * courseRadius + courseBandWidth;
        var sem = courseDetails.append("svg")
          .attr("height", size)
          .attr("width", size);
        sem.append("circle")
          .attr("r", courseRadius - (courseBandWidth / 2))
          .attr("cx", size / 2)
          .attr("cy", size / 2)
          .attr("class", "node")
          .attr("stroke", defaultGray)
          .attr("fill", defaultGray);
        sem.append("rect")
          .attr("class", "semester-rect")
          .attr("height", size)
          .attr("width", size / 2)
          .attr("x", d => (size / 2) * (2 - c.Semester));

        //studiepunten
        courseDetails.append("div")
          .attr("class", "course-points")
          .text(c.Studiepunten + " studiepunten");
      }

      // beschrijving
      infobox.append("p")
        .text(function () {
          return c.Beschrijving;
        });

      var radioButtons = infobox.append("div")
        .attr("class", "infobox-buttons");

      // radiobutton "Geïnteresseerd"
      var radiobuttonInterested = radioButtons.append("label")
        .text("Geïnteresseerd in dit vak");
      radiobuttonInterested.attr("class", "radiobutton")
        .append("input")
        .attr("type", "radio")
        .attr("name", "radio")
        .attr("value", "interested")
        .property("checked", true);
      radiobuttonInterested.append("span")
        .attr("class", "checkmark");
      radiobuttonInterested.on("change", toggleStatusRadioButtons);

      // radiobutton "Niet geïnteresseerd"
      var radiobuttonNotInterested = radioButtons.append("label")
        .text("Niet geïnteresseerd in dit vak");
      radiobuttonNotInterested.classed("radiobutton", true)
        .classed("hidden", function () {
          if (optionChosen) {
            var chosenOption = hypergraph.select(".option-chosen").datum().ID;
            var isBachelorExtending1 = c[extraOptionNames[0]] == 1;
            var isBachelorExtending2 = c[extraOptionNames[1]] == 1;
            var isCompulsory = c[chosenOption] == 1;
            return isCompulsory || isBachelorExtending1 || isBachelorExtending2;
          }
        })
        .append("input")
        .attr("type", "radio")
        .attr("name", "radio")
        .attr("value", "not-interested")
        .property("checked", course.classed("not-interested") || course.classed("is-not-interested"));
      radiobuttonNotInterested.append("span")
        .attr("class", "checkmark");
      radiobuttonNotInterested.on("change", toggleStatusRadioButtons);

      if (optionChosen) {
        // radiobutton "Kies in 1ste Master"
        var radiobuttonChoose1 = radioButtons.append("label")
          .attr("class", "radiobutton radiobutton-chosen-master1")
          .text("Kies dit vak in 1ste Master");
        radiobuttonChoose1.append("input")
          .attr("type", "radio")
          .attr("name", "radio")
          .attr("value", "choose1")
          .property("checked", course.classed("chosen-master1"));
        radiobuttonChoose1.append("span")
          .attr("class", "checkmark");
        radiobuttonChoose1.on("change", toggleStatusRadioButtons);

        // radiobutton "Kies in 2de Master"
        var radiobuttonChoose2 = radioButtons.append("label")
          .text("Kies dit vak in 2de Master");
        radiobuttonChoose2.attr("class", "radiobutton radiobutton-chosen-master2")
          .append("input")
          .attr("type", "radio")
          .attr("name", "radio")
          .attr("value", "choose2")
          .property("checked", course.classed("chosen-master2"));
        radiobuttonChoose2.append("span")
          .attr("class", "checkmark");
        radiobuttonChoose2.on("change", toggleStatusRadioButtons);
      }
    }

    updateOptionList();

    // Stap 1 vullen met opties
    function updateOptionList() {
      // infobox.select(".optionlist").selectAll(li).remove();

      var li = infobox.select(".optionlist").selectAll(li)
        .data(optionNames);

      var liEnter = li.enter()
        .append("li")
        .text(d => d)
        .on("mouseover", function (d) {
          var opt = hypergraph.selectAll(".option-node")
            .filter(o => o.ID == d);
          toggleHighlightOption(opt.datum());
        })
        .on("mouseout", function (d) {
          var opt = hypergraph.selectAll(".option-node")
            .filter(o => o.ID == d);
          toggleHighlightOption(opt.datum());
        })
        .on("click", function (d) {
          var opt = hypergraph.selectAll(".option-node")
            .filter(o => o.ID == d);
          toggleActive(opt);
          fillInfoboxForOption(opt);
          toggleClickabilityOptions(opt.datum());
          toggleClickabilityCourses(opt.datum());
          toggleHighlightOption(opt.datum());
        });
      var size = optionRadius * 2.5;
      var svg = liEnter.append("svg")
        .attr("height", size)
        .attr("width", size);

      svg.append("circle")
        .attr("r", optionRadius)
        .attr("cx", size / 2)
        .attr("cy", size / 2)
        .attr("fill", d => {
          return colors[options.indexOf(options.filter(o => o.ID == d)[0])];
        });
    }
    //
    // updateChosenOptionList();
    // // Stap 1 vullen met opties
    // function updateChosenOptionList() {
    //   var li = infobox.select(".chosen-option").selectAll(li)
    //     .data(function () {
    //         return [hypergraph.select(".option-chosen").datum().ID];
    //     })
    //
    //   li.exit().remove();
    //
    //   var liEnter = li.enter().merge(li)
    //     .append("li")
    //     .text(d => d)
    //     .on("mouseover", function (d) {
    //       var opt = hypergraph.selectAll(".option-node")
    //         .filter(o => o.ID == d);
    //       toggleHighlightOption(opt.datum());
    //     })
    //     .on("mouseout", function (d) {
    //       var opt = hypergraph.selectAll(".option-node")
    //         .filter(o => o.ID == d);
    //       toggleHighlightOption(opt.datum());
    //     })
    //     .on("click", function (d) {
    //       var opt = hypergraph.selectAll(".option-node")
    //         .filter(o => o.ID == d);
    //       toggleActive(opt);
    //       fillInfoboxForOption(opt);
    //       toggleClickabilityOptions(opt.datum());
    //       toggleClickabilityCourses(opt.datum());
    //       toggleHighlightOption(opt.datum());
    //     });
    //   var size = optionRadius * 2.5;
    //   var svg = liEnter.append("svg")
    //     .attr("height", size)
    //     .attr("width", size);
    //
    //   svg.append("circle")
    //     .attr("r", optionRadius)
    //     .attr("cx", size / 2)
    //     .attr("cy", size / 2)
    //     .attr("fill", d => {
    //       return colors[options.indexOf(options.filter(o => o.ID == d)[0])];
    //     });
    //   }

    /**
    * 8. Interactie met de infobox
    */

    function toggleOptionChosen() {
      optionChosen = !optionChosen;
      var activeOption = hypergraph.select(".option-node.active");
      activeOption.node().classList.toggle("option-chosen");

      if (optionChosen && bachelor == null) {
        hypergraph.style("opacity", 1)
          .transition()
          .duration(1000)
          .style("opacity", 0)
          .on("end", showChooseBachelor);
        enableStap2();
      } else if (optionChosen) {
        moveHypergraph(250);
        showExtraCourses();
        updateGauges();
        enableStap2();
      } else {
        hideExtraCourses(250);
        updateGauges();
        enableStap1();
      }
    }

    function showChooseBachelor() {
      hypergraph.attr("display", "none");
      var chooseBachelorContainer = hypergraphContainer.insert("div", ":first-child")
        .attr("class", "choose-bachelor-container");
      var chooseBachelor = chooseBachelorContainer.append("div")
        .attr("class", "choose-bachelor")
        .style("opacity", 0);
      chooseBachelor.append("p")
        .text("Je moet enkele vakken verplicht opnemen, afhankelijk van je voorkennis.");
      chooseBachelor.append("p")
        .text("Welke Bachelor heb je gevolgd?");
      chooseBachelor.append("p")
        .attr("class", "choose-bachelor-button")
        .text("Ingenieurswetenschappen: computerwetenschappen")
        .on("click", function () {
          bachelorChosen(extraOptionNames[0], extraOptionNames[1]);
        });
      chooseBachelor.append("p")
        .attr("class", "choose-bachelor-button")
        .text("Informatica")
        .on("click", function () {
          bachelorChosen(extraOptionNames[1], extraOptionNames[0]);
        });
      chooseBachelor.transition()
        .duration(1000)
        .style("opacity", 1);
      var option = hypergraph.select(".option-node.active");
      var o = option.datum();
      toggleActive(option);
      emptyInfobox();
      toggleHighlightOption(o);
      toggleClickabilityOptions(o);
      toggleClickabilityCourses(o);
    }

    function bachelorChosen(chosen, notChosen) {
      bachelor = chosen;
      data = data.filter(d => d[notChosen] == 0);
      drawExtraCoursesLabels();
      simulateExtraCourses();
      hideChooseBachelor();
    }

    function drawExtraCoursesLabels() {
      var extraCoursesLabelY = 50;
      var extraCoursesSpacing = 30;
      for (name of extraOptionGroupNames) {
        if (extraOptionGroupNames.indexOf(name) == 0) {
          var extra = coursesCompulsoryForAllOptions
            .concat(data.filter(d => d[bachelor] > 0));
        } else {
          var extra = extraData.filter(d => d[name] > 0);
        }

        hypergraph.append("text")
          .text(name)
          .attr("class", "hypergraph-text")
          .attr("x", 30 - courseRadius)
          .attr("y", extraCoursesLabelY)
          .style("display", "none");

        extraCoursesLabelY += (Math.ceil(extra.length / 7) * 35 + 2 * extraCoursesSpacing);
      }
    }

    function hideChooseBachelor() {
      var chooseBachelorContainer = hypergraphContainer.select(".choose-bachelor-container");
      chooseBachelorContainer.transition()
        .duration(1000)
        .style("opacity", 0)
        .on("end", function () {
          chooseBachelorContainer.remove();
          hypergraph.attr("display", "block")
            .style("opacity", 1);
          moveHypergraph(250);
          showExtraCourses();
        });

    }

    function moveHypergraph(xOffset) {
      var notExtra = hypergraph.selectAll(".course-node:not(.extra-course-node)");
      svgWidth += xOffset;
      hypergraph.transition()
        .duration(1000)
        .attr("width", svgWidth);
      hypergraph.selectAll(".link")
        .transition()
        .duration(1000)
        .attr("x1", d => d.source.x + xOffset)
        .attr("x2", d => d.target.x + xOffset);
      hypergraph.selectAll(".option-node").transition()
        .duration(1000)
        .attr("cx", d => d.x + xOffset)
        .on("end", d => d.x += xOffset);
      notExtra.transition()
        .duration(1000)
        .attr("transform", d => "translate(" + (d.x + xOffset - courseRadius) + "," + (d.y - courseRadius) + ")")
        .on("end", function (d, i) {
          d.x += xOffset;
          if (i == 0) {
            root.fx += xOffset;
            updateHypergraph();
          }
        });
    }

    function showExtraCourses() {
      hypergraph.selectAll(".extra-course-node")
        .style("opacity", 0)
        .style("display", "block")
        .transition()
        .delay(1000)
        .duration(1000)
        .style("opacity", 1)
        .style("opacity", null);
      hypergraph.selectAll(".hypergraph-text")
        .style("opacity", 0)
        .style("display", "block")
        .transition()
        .delay(1000)
        .duration(1000)
        .style("opacity", 1)
        .style("opacity", null);
    }

    function hideExtraCourses(xOffset) {
      var notExtra = hypergraph.selectAll(".course-node:not(.extra-course-node)");
      hypergraph.selectAll(".extra-course-node")
        .style("display", "none");
      hypergraph.selectAll(".hypergraph-text")
        .style("display", "none");
      hypergraph.selectAll(".link")
        .transition()
        .delay(500)
        .duration(1000)
        .attr("x1", d => d.source.x - xOffset)
        .attr("x2", d => d.target.x - xOffset);
      hypergraph.selectAll(".option-node").transition()
        .delay(500)
        .duration(1000)
        .attr("cx", d => d.x - xOffset)
        .on("end", d => d.x -= xOffset);
      notExtra
        .transition()
        .delay(500)
        .duration(1000)
        .attr("transform", d => "translate(" + (d.x - xOffset - courseRadius) + "," + (d.y - courseRadius) + ")")
        .on("end", function (d, i) {
          d.x -= xOffset;
          if (i == 0) {
            root.fx -= xOffset;
          }
        });
      hypergraph
        .transition()
        .delay(500)
        .duration(1000)
        .attr("width", function () {
          return svgWidth - xOffset;
        })
        .on("end", function () {
          svgWidth -= xOffset;
          updateHypergraph();
        });
    }

    function toggleStatusRadioButtons() {
      var radioButton = d3.select(this);
      var course = hypergraph.select(".course-node.active");
      var value = radioButton.select("input").node().value;
      if (value == "interested") {
        toggleStatusInterested(course);
        course.classed("chosen-master1", false);
        course.classed("chosen-master2", false);
      } else if (value == "not-interested") {
        toggleStatusNotInterested(course);
        course.classed("chosen-master1", false);
        course.classed("chosen-master2", false);
      } else if (value == "choose1") {
        course.classed("not-interested", false);
        course.node().classList.toggle("chosen-master1");
        course.classed("chosen-master2", false);
        showHiddenPrerequisites(course);
      } else if (value == "choose2") {
        course.classed("not-interested", false);
        course.classed("chosen-master1", false);
        course.node().classList.toggle("chosen-master2");
        showHiddenPrerequisites(course);
      }
      updateBarchart();
      updateGauges();
    }

    function toggleStatusInterested(course) {
      course.classed("not-interested", false);
      // updateHypergraph();
    }

    function toggleStatusNotInterested(course) {
      var switchInterestedChecked = switchInterested.property("checked");
      if (switchInterestedChecked) {
        course.node().classList.toggle("not-interested");
      } else {
        var c = course.datum();
        var courseLinks = links.filter(l => l.target == c);
        hiddenLinks = hiddenLinks.concat(courseLinks);
        hiddenCourses.push(c);
        data = data.filter(d => d != c);
        links = links.filter(l => !courseLinks.includes(l));
        if (course.classed("active")) {
          toggleHighlightCourse(c);
          toggleScheduleOverlap(course);
        }
        emptyInfobox();
        infobox.select(".help").classed("hidden", false);
        updateHypergraph();
      }
    }

    function showHiddenPrerequisites(course) {
      var c = course.datum();
      var prerequisites = c["Gelijktijdig volgen"].split(" ");
      for (hidden of hiddenCourses) {
        if (prerequisites.includes(hidden.ID)) {
          data.push(hidden);
          hiddenCourses = hiddenCourses.filter(h => h.ID != hidden.ID);
          var prerequisiteLinks = hiddenLinks.filter(l => l.target == hidden);
          links = links.concat(prerequisiteLinks);
          hiddenLinks = hiddenLinks.filter(l => !prerequisiteLinks.includes(l));
          updateHypergraph();
        }
      }
    }

    function enableStap1() {
      infobox.selectAll(".stap1").classed("hidden", false);
      infobox.selectAll(".stap2").classed("hidden", true);
      updateOptionList();
    }

    function enableStap2() {
      infobox.selectAll(".stap1").classed("hidden", true);
      infobox.selectAll(".stap2").classed("hidden", false);
      updateOptionList();
    }

    /**
    * 9. Switch
    */

    switchInterested.on("change", function () {
      var activeOption = hypergraph.select(".option-node.active");
      if (switchInterested.property("checked")) {
        links = links.concat(hiddenLinks);
        data = data.concat(hiddenCourses);
        hiddenLinks = [];
        hiddenCourses = [];
        updateHypergraph();
      } else {
        hypergraph.selectAll(".course-node.not-interested")
          .each(function (c) {
            var courseLinks = links.filter(l => l.target == c);
            hiddenLinks = hiddenLinks.concat(courseLinks);
            hiddenCourses.push(c);
            data = data.filter(d => d != c);
            links = links.filter(l => !courseLinks.includes(l));
          });
        var activeCourse = hypergraph.select(".course-node.active.not-interested");
        if (!activeCourse.empty()) {
          toggleHighlightCourse(activeCourse.datum());
          toggleScheduleOverlap(activeCourse);
          emptyInfobox();
        }
        updateHypergraph();
      }
      if (!activeOption.empty()) {
        fillInfoboxForOption(activeOption);
      }
    });

    /**
     * 10. Uurrooster
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
     * 11. Opbouw van de barchart
     */

    barchart.attr("width", svgWidth)
      .attr("height", 4 * barHeight + 3 * barSpacing);

    // voeg labels toe voor de balken
    for (i = 1; i <= 4; i++) {
      barchart.append("text")
        .attr("y", barHeight * i + barSpacing * (i - 1) - (barHeight - 10) / 2)
        .attr("class", "barchart-text")
        .text("semester " + i);
    }

    // update de balken in de bar chart
    function updateBarchart() {
      var chosenCourse1Exist = !hypergraph.select(".chosen-master1").empty();
      var chosenCourse2Exist = !hypergraph.select(".chosen-master2").empty();
      barchart.classed("hidden", !chosenCourse1Exist && !chosenCourse2Exist);
      updateBarchartYear(1);
      updateBarchartYear(2);
    }

    // update de balken voor het opgegeven jaar
    function updateBarchartYear(year) {
      var chosen = hypergraph.selectAll(".chosen-master" + year);
      updateBarchartSemester(chosen, year, 1);
      updateBarchartSemester(chosen, year, 2);
    }

    // update de balken voor de gekozen vakken in het gegeven jaar en semester
    function updateBarchartSemester(chosen, year, semester) {
      var barXOffset = barchartLeftMargin;
      var chosenSemester = chosen.filter(c => (c.Semester == 3) || (c.Semester == semester));
      var semesterTotal = chosenSemester.data().reduce((total, c) => total + parseInt(semestrialPoints(c)), 0);
      chosenSemester = chosenSemester.sort(function (a, b) {
        return semestrialPoints(a) > semestrialPoints(b);
      });

      var semesterNummer = 2 * (year - 1) + semester;
      var bars = barchart.selectAll(".rect-sem" + semesterNummer)
        .data(chosenSemester.data(), d => d.ID);

      bars.enter()
        .append("rect")
        .attr("class", "rect-sem rect-sem" + semesterNummer)
        .attr("width", d => semestrialPoints(d) * creditLength - barSpacing)
        .attr("height", barHeight)
        .attr("rx", barRound)
        .attr("ry", barRound)
        .attr("fill", d => colorOfCourse(d))
        .attr("y", (barHeight + barSpacing) * (semesterNummer - 1))
        .on("mouseover", function (d) {
          showTooltip(d);
          if (!activeNodeExists()) {
            toggleHighlightCourse(d);
          }
        })
        .on("mouseout", function (d) {
          hideTooltip();
          if (!activeNodeExists()) {
            toggleHighlightCourse(d);
          }
        })
        .on("click", function (d) {
          // zoek de node die overeenkomt met de bar
          var node = hypergraph.selectAll(".node")
            .filter(n => n.ID == d.ID);
          courseClicked(node);
        })
        .merge(bars)
        .transition(transition)
        .attr("x", function (d) {
          var barWidth = creditLength * semestrialPoints(d);
          var oldXOffset = barXOffset;
          //barXOffset += barWidth + barSpacing;
          barXOffset += barWidth
          return oldXOffset;
        });

      // draw total amount of stp in text
      barchart.select(".barchart-label" + semesterNummer).remove();
      if (semesterTotal !== 0) {
        barchart.append("text")
          .attr("class", "barchart-text barchart-label barchart-label" + semesterNummer)
          .attr("x", barchartLeftMargin + semesterTotal * creditLength + 5)
          .attr("y", barHeight * semesterNummer + barSpacing * (semesterNummer - 1) - (barHeight - 10) / 2)
          .text(semesterTotal);
      }

      bars.exit().remove();
    }


    /**
   * 13. visualisatie aantal studiepunten
   */

    // create svg's for each bar
    var gaugeWidth = 85;
    var gaugeHeight = 85;
    var gaugeLabels = ["totaal", "optie", "verdere optie", "AVO"];

    gauges.append("svg")
      .attr("width", gaugeWidth)
      .attr("height", gaugeHeight)
      .attr("id", "gauge1")
      .attr("class", "gauge")
      .on("mouseover", (d, a, b) => showTooltipGauge(b, 0))
      .on("mouseout", hideTooltipGauge)
      .append("text")
      .text(gaugeLabels[0])
      .attr("x", gaugeWidth / 2)
      .attr("y", gaugeHeight - 5)
      .attr("text-anchor", "middle");
    gauges.append("svg")
      .attr("width", gaugeWidth)
      .attr("height", gaugeHeight)
      .attr("id", "gauge2")
      .attr("class", "gauge")
      .on("mouseover", (d, a, b) => showTooltipGauge(b, 1))
      .on("mouseout", hideTooltipGauge)
      .append("text")
      .text(gaugeLabels[1])
      .attr("x", gaugeWidth / 2)
      .attr("y", gaugeHeight - 5)
      .attr("text-anchor", "middle");
    gauges.append("svg")
      .attr("width", gaugeWidth)
      .attr("height", gaugeHeight)
      .attr("id", "gauge3")
      .attr("class", "gauge")
      .on("mouseover", (d, a, b) => showTooltipGauge(b, 2))
      .on("mouseout", hideTooltipGauge)
      .append("text")
      .text(gaugeLabels[2])
      .attr("x", gaugeWidth / 2)
      .attr("y", gaugeHeight - 5)
      .attr("text-anchor", "middle");
    gauges.append("svg")
      .attr("width", gaugeWidth)
      .attr("height", gaugeHeight)
      .attr("id", "gauge4")
      .attr("class", "gauge")
      .on("mouseover", (d, a, b) => showTooltipGauge(b, 3))
      .on("mouseout", hideTooltipGauge)
      .append("text")
      .text(gaugeLabels[3])
      .attr("x", gaugeWidth / 2)
      .attr("y", gaugeHeight - 5)
      .attr("text-anchor", "middle");


    // put gauge in each svg
    var config1 = liquidFillGaugeDefaultSettings();
    config1.maxValue = 120;
    config1.suffix = "";
    var gauge1 = loadLiquidFillGauge("gauge1", 0, config1);

    var config2 = liquidFillGaugeDefaultSettings();
    config2.maxValue = 18;
    config2.suffix = "";
    var gauge2 = loadLiquidFillGauge("gauge2", 0, config2);
    var config3 = liquidFillGaugeDefaultSettings();
    config3.maxValue = 18;
    config3.suffix = "";
    var gauge3 = loadLiquidFillGauge("gauge3", 0, config3);
    var config4 = liquidFillGaugeDefaultSettings();
    config4.maxValue = 14;
    config4.enoughValue = 12;
    config4.suffix = "";
    config4.toomuchValue = 15;
    var gauge4 = loadLiquidFillGauge("gauge4", 0, config4);

    // create tooltip
    var tooltipGauge = gaugesContainer.select(".gauges-svg").append("div")
      .attr("class", "tooltip");

    // toon een tooltip die na 1s weer verdwijnt voor de gegeven node
    function showTooltipGauge(b, i) {
      var tekst;
      var rect = b[0].getBoundingClientRect();
      var bodyRect = document.body.getBoundingClientRect();
      switch (i) {
        case 0:
          tekst = "Kies in totaal minstens 120 studiepunten"
          break;
        case 1:
          tekst = "Kies minstens 18 studiepunten uit je gekozen optie"
          break;
        case 2:
          tekst = "Kies minstens 18 studiepunten uit alle opties of verdere optie"
          break;
        case 3:
          tekst = "Kies minstens 12 en ten hoogste 14 studiepunten uit AVO"
          break;
      }
      tooltipGauge.classed("active", true)
        .text(tekst)
        .style("left", (rect.left - bodyRect.left) + "px")
        .style("top", (rect.top - bodyRect.top - 20) + "px");
    }

    // verberg de tooltip
    function hideTooltipGauge() {
      tooltipGauge.classed("active", false);
    }

    function updateGauges() {
      var verdereOptie = extraOptionNames[2];
      var AVO = extraOptionNames[3];

      // haal alle gekozen vakken
      var chosen1 = hypergraph.selectAll(".chosen-master1").data();
      var chosen2 = hypergraph.selectAll(".chosen-master2").data();
      var chosen = chosen1.concat(chosen2);
      if (optionChosen) {
        var chosenOption = hypergraph.select(".option-chosen").datum().ID;
      }

      gaugesContainer.classed("hidden", chosen.length == 0);

      // bereken totaal aantal studiepunten
      var total = getTotalStp(chosen);

      var inOption = chosen
        .filter(d => 0 < d[chosenOption])
        .filter(d => !coursesCompulsoryForAllOptions.includes(d));

      // komt uit verdere optie of uit eigen keuze of andere opties
      var inOptionExtra = chosen
        .filter(d => d[chosenOption] == 0)
        .filter(function (d) {
          return (0 < d[verdereOptie]) || (d["Bachelorverbredend pakket (bachelor in de ingenieurswetenschappen: computerwetenschappen)"] == 0 && d["Bachelorverbredend pakket (bachelor in informatica)"] == 0 && !coursesCompulsoryForAllOptions.includes(d) && d[AVO] == 0);
        });
      var inAVO = chosen.filter(d => 0 < d[AVO]);

      inOption = getTotalStp(inOption);
      inOptionExtra = getTotalStp(inOptionExtra);
      inAVO = getTotalStp(inAVO);
      // overflow binnen eigen optie telt mee voor verdere optie
      if (inOption > 18) {
        inOptionExtra += (inOption - 18);
      }

      gauge1.update(total);
      gauge2.update(inOption);
      gauge3.update(inOptionExtra);
      gauge4.update(inAVO);
    }

    function getTotalStp(courses) {
      return courses.reduce((total, c) => total + parseInt(c.Studiepunten), 0);
    }
  });
});
