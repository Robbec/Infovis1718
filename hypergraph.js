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
var hypergraphContainer = left.select(".hypergraph-container");
var hypergraph = hypergraphContainer.select(".hypergraph");
var barchartContainer = left.select(".barchart-container");
var barchart = barchartContainer.select(".barchart");
var switchInterested = right.select(".switch-interested").select("input");
var infobox = right.select(".infobox");

// globale variabelen voor de opbouw van de hypergraf
var options = [];
var links = [];
var hiddenCourses = [];
var hiddenLinks = [];
var courseRadius = 10;
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

d3.csv("cw-6.csv").then(function (data) {
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
    var forceCollide = d3.forceCollide(courseRadius * 1.3).strength(1);

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
            return -50;
          }
        })
      )
      // voorkom dat nodes overlappen
      .force("collide", forceCollide)
      // duw verbonden elementen uit elkaar
      .force("link", d3.forceLink(links)
        .distance(40)
        .strength(0.5)
      )
      // roep ticked() op in elke iteratiestap van de simulatie
      .on("tick", ticked);

    // deze functie wordt opgeroepen in elke iteratiestap van de simulatie
    function ticked() {
      // pas de positie aan van de course nodes
      hypergraph.selectAll(".course-node")
        .attr("transform", function (d) {
          var courseX = boxBoundedX(d.x);
          var courseY = boxBoundedY(d.y);
          return "translate(" + courseX + "," + courseY + ")";
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
        var b = (courseRadius + 2.5) / l;
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
        .strength(-300)
      );

    function simulateExtraCourses() {
      var labelY = 50;
      var spacing = 30;
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
          .attr("x", 18.5)
          .attr("y", labelY)
          .style("display", "none");

        d3.forceSimulation(extra)
          .force("x", d3.forceX(function (d) {
            return 30 + (extra.indexOf(d) % 7) * 35;
          }))
          .force("y", d3.forceY(function (d) {
            return labelY + spacing + Math.floor(extra.indexOf(d) / 7) * 35;
          }));

        labelY += (Math.ceil(extra.length / 7) * 35 + 2 * spacing);
      }
    }

    // bound the given x coordinate to the visible part of the hypergraph
    function boxBoundedX(x) {
      return Math.max(courseRadius + 2.5, Math.min(svgWidth - courseRadius - 2.5, x));
    }

    // bound the given y coordinate to the visible part of the hypergraph
    function boxBoundedY(y) {
      return Math.max(courseRadius + 2.5, Math.min(svgHeight - courseRadius - 2.5, y));
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
      var course = hypergraph.selectAll(".course-node")
        .data(data, d => d.ID);

      course.enter().each(function (c) {
        var optionData = d3.values(c)
          .splice(indexFirstOption, optionNames.length)
          .map(e => (e > 0) ? 1 : 0);
        var pie = d3.pie()(optionData);
        var arc = d3.arc()
          .innerRadius(0)
          .outerRadius(10)
          .startAngle(0)
          .endAngle(2*Math.PI)
          ;

        d3.select(this)
          .append("path")
          .attr("d", arc)
          .classed("node course-node", true)
          .classed("compulsory", function (d) {
            return checkCompulsoryOrOptional(d, 1);
          })
          .classed("optional", function (d) {
            return checkCompulsoryOrOptional(d, 2);
          })
          .classed("not-interested", switchInterested.property("checked"))
          .classed("extra-course-node", d => extraData.includes(d))
          .style("display", function (d) {
            if (extraData.includes(d)) {
              return "none";
            }
          })
          .attr("fill", function (d) {
            return colorOfCourse(d);
          })
          .attr("stroke", function (d) {
            return colorOfCourse(d);
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
      });

      course.exit().remove();
    }

    function updateHypergraph() {
      updateLinks();
      updateOptionNodes();
      updateCourseNodes();
      simulationNodes.alpha(0.5).restart();
      simulationOptionNodes.alpha(0.5).restart();
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
      return data.filter(function (d) {
        return (0 < d[o.OPO]) && (getCourseOptions(d).length < optionNames.length);
      });
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
        resizeCourseNode(activeCourse, 2 / 3);
        toggleHighlightCourse(activeCourse.datum());
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
        resizeCourseNode(activeCourse, 2 / 3);
        toggleHighlightCourse(activeCourse.datum());
        toggleActive(activeCourse);
        toggleActive(option);
        toggleHighlightOption(o);
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
        resizeCourseNode(course, 2 / 3);
        toggleActive(course);
        emptyInfobox();
      } else if (activeCourseExists) {
        var ac = activeCourse.datum();
        // opmerking: de highlights voor de betrokken vakken moeten nu aangepast worden
        resizeCourseNode(activeCourse, 2 / 3);
        toggleHighlightCourse(ac);
        toggleActive(activeCourse);
        resizeCourseNode(course, 1.5);
        toggleHighlightCourse(c);
        toggleActive(course);
        fillInfoboxForCourse(course);
      } else if (activeOptionExists && getOptionCourses(ao).includes(c)) {
        // opmerking: de prerequisites zijn al gehighlightet vanwege de hover
        toggleActive(activeOption);
        resizeCourseNode(course, 1.5);
        toggleActive(course);
        fillInfoboxForCourse(course);
        toggleClickabilityOptions(ao);
        toggleClickabilityCourses(ao);
      } else if (!activeNodeExists()) {
        // opmerking: de prerequisites zijn al gehighlightet vanwege de hover
        resizeCourseNode(course, 1.5);
        toggleActive(course);
        fillInfoboxForCourse(course);
      }

      // // sla alle vakken op die overlappen met het actieve vak
      // if (!newActiveCourse.empty()) {
      //   var scheduleOverlappingCourses = getScheduleOverlappingCourses(newActiveCourse.datum()["ID"]);
      // }
      //
      // // geef de klasse .schedule-overlap alleen aan vakken die overlappen met het actieve vak
      // hypergraph.selectAll(".course-node")
      //   .classed("schedule-overlap", function (dcircle) {
      //     var id = dcircle.ID;
      //     if (!newActiveCourse.empty()) {
      //       return scheduleOverlappingCourses.has(id);
      //     }
      //     return false;
      //   });
    }

    // verander de straal van de gegeven course node met de gegeven factor
    function resizeCourseNode(course, factor) {
      var newRadius = course.attr("r") * factor;
      course.transition(transition).attr("r", newRadius);
      forceCollide.radius(function (d, i) {
        if (d == course.datum()) {
          return newRadius + 5;
        } else {
          return 15;
        }
      });
      simulationNodes.alpha(0.05).restart();
      simulationOptionNodes.alpha(0.05).restart();
    }

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
          if (c.ID != course.ID && !prerequisites.split(" ").includes(c.ID)) {
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
        .style("left", (boxBoundedX(d.x) + 20) + "px")
        .style("top", (boxBoundedY(d.y) - 12) + "px");
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
     * 7. Opbouw van de infobox
     */

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
        var checkboxChoose = infobox.append("label")
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
      var size = courseRadius * 2.5;
      var svg = courses.append("svg")
        .attr("height", size)
        .attr("width", size);

      svg.append("circle")
        .attr("r", courseRadius)
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
      //Semester, ik wil dit eigenlijk langs de titel, want langs de studiepunten ziet er niet mooi uit
      var size = optionRadius*2.5;
      var sem = infobox.append("svg")
        .attr("height", size)
        .attr("width", size);
      sem.append("circle")
        .attr("r", optionRadius)
        .attr("cx", size / 2)
        .attr("cy", size / 2)
        .classed("courseBulletPoint", true)
        .attr("fill", defaultGray);
      sem.append("rect")
        .attr("class", "semester-rect")
        .attr("height", size)
        .attr("width", size / 2)
        .attr("x", d => (size / 2) * (2 - c.Semester));
      // titel
      infobox.append("h3")
        .text(c.OPO)
      // studiepunten
      var points = infobox.append("svg")
        .attr("height", size);
      var infoBarHeight = optionRadius * 2;
      var rounding = barRound * infoBarHeight / barHeight;
      var x = 0;
      var projectLength = c.Project * creditLength;
      if (projectLength > 0) {
        points.append("rect")
          .attr("x", x)
          .attr("y", (size - infoBarHeight)/2)
          .attr("width", projectLength)
          .attr("height", infoBarHeight)
          .attr("rx", rounding)
          .attr("ry", rounding)
          .attr("fill", defaultGray);
        x += projectLength + barSpacing;
      }
      var examLength = c.Examen * creditLength;
      if (examLength > 0) {
        points.append("rect")
          .attr("x", x)
          .attr("y", (size - infoBarHeight)/2)
          .attr("width", examLength)
          .attr("height", infoBarHeight)
          .attr("rx", rounding)
          .attr("ry", rounding)
          .attr("fill", defaultGray);
          x += examLength + 5;
      }
      points.append("text")
        .text(c.Studiepunten)
        .attr("x", x)
        .attr("y", infoBarHeight);
      // studiepunten
      // infobox.append("div")
      //   .attr("class", "points")
      //   .text(c.Studiepunten + " SP");
      // var stpContainer = infobox.select(".points");
      // stpContainer.append("svg")
      //   .attr("class", "stp");
      // var stp = stpContainer.select(".stp");
      //
      // // x position
      // var x = 0;
      // var projectStp = course.Project;
      // // als het vak een project deel heeft
      // if (projectStp > 0) {
      //   // een vierkantje voor elk geheel projectdeel
      //   var floorProjectStp = Math.floor(projectStp);
      //   for (i = 0; i < floorProjectStp; i++) {
      //     stp.append("rect")
      //       .attr("x", x)
      //       .attr("width", stpSize)
      //       .attr("height", stpSize)
      //       .attr("fill", kulBlue);
      //     x += stpSize + 1;
      //   }
      //   // een rechthoekje in verhouding met het niet gehele projectdeel
      //   var afterPoint = projectStp - floorProjectStp;
      //   if (afterPoint > 0) {
      //     var extraWidth = stpSize * afterPoint;
      //     stp.append("rect")
      //       .attr("x", x)
      //       .attr("width", extraWidth)
      //       .attr("height", stpSize)
      //       .attr("fill", kulBlue);
      //     x += extraWidth + 1;
      //   }
      // }
      //
      // var examStp = course.Examen;
      // //als het vak een examendeel heeft
      // if (examStp > 0) {
      //   // een rechthoekje in verhouding met het niet gehele examen deel
      //   // eerst zodat dit past bij het niet gehele projectdeel
      //   var floorExamStp = Math.floor(examStp);
      //   var afterPoint = examStp - floorExamStp;
      //   if (afterPoint > 0) {
      //     var extraWidth = stpSize * afterPoint;
      //     stp.append("rect")
      //       .attr("x", x)
      //       .attr("width", extraWidth)
      //       .attr("height", stpSize)
      //       .attr("fill", kulOrange);
      //     x += extraWidth + 1;
      //   }
      //   // een vierkantje voor elk geheel examen deel
      //   for (i = 0; i < floorExamStp; i++) {
      //     stp.append("rect")
      //       .attr("x", x)
      //       .attr("width", stpSize)
      //       .attr("height", stpSize)
      //       .attr("fill", kulOrange);
      //     x += stpSize + 1;
      //   }
      // }

      // beschrijving
      infobox.append("p")
        .text(function () {
          return c.Beschrijving;
        });

      // radiobutton "Geïnteresseerd"
      var radiobuttonInterested = infobox.append("label")
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
      var radiobuttonNotInterested = infobox.append("label")
        .text("Niet geïnteresseerd in dit vak");
      radiobuttonNotInterested.attr("class", "radiobutton")
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
        var radiobuttonChoose1 = infobox.append("label")
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
        var radiobuttonChoose2 = infobox.append("label")
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
      } else if (optionChosen) {
        moveHypergraph(250);
        showExtraCourses();
      } else {
        hideExtraCourses(250);
      }
    }

    function showChooseBachelor() {
      hypergraph.attr("display", "none");
      var chooseBachelorContainer = left.insert("div", ":first-child")
        .attr("class", "choose-bachelor-container");
      var chooseBachelor = chooseBachelorContainer.append("div")
        .attr("class", "choose-bachelor")
        .style("opacity", 0);
      chooseBachelor.append("p")
        .text("Je moet enkele vakken verplicht opnemen, afhankelijk van je voorkennis.");
      chooseBachelor.append("p")
        .text("Welke Bachelor heb je gevolgd?");
      var chooseBachelorButtons = chooseBachelor.append("div");
      chooseBachelorButtons.append("p")
        .attr("class", "choose-bachelor-button")
        .text("Ingenieurswetenschappen: computerwetenschappen")
        .on("click", function () {
          bachelorChosen(extraOptionNames[0], extraOptionNames[1]);
        });
      chooseBachelorButtons.append("p")
        .attr("class", "choose-bachelor-button")
        .text("Informatica")
        .on("click", function () {
          bachelorChosen(extraOptionNames[1], extraOptionNames[0]);
        });
      chooseBachelor.transition()
        .duration(1000)
        .style("opacity", 1);
    }

    function bachelorChosen(chosen, notChosen) {
      bachelor = chosen;
      hypergraph.selectAll(".course-node")
        .filter(d => d[notChosen] > 0)
        .remove();
      simulateExtraCourses();
      hideChooseBachelor();
    }

    function hideChooseBachelor() {
      var chooseBachelorContainer = left.select(".choose-bachelor-container");
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
        .attr("transform", d => "translate(" + (d.x + xOffset) + "," + d.y + ")")
        .on("end", function (d, i) {
          d.x += xOffset;
          if (i == 0) {
            root.fx += xOffset;
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
        .style("opacity", 1);
      hypergraph.selectAll(".hypergraph-text")
        .style("opacity", 0)
        .style("display", "block")
        .transition()
        .delay(1000)
        .duration(1000)
        .style("opacity", 1);
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
        .attr("transform", d => "translate(" + (d.x - xOffset) + "," + d.y + ")")
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
      updateStpbox();
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
        }
        emptyInfobox();
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
    function getTotalStp(courses) {
      return courses.reduce((total, c) => total + parseInt(c.Studiepunten), 0);
    }

    var stpbox = right.select(".stpbox");

    // create svg's for each bar
    var svg1 = stpbox.append("svg")
      .attr("width", 70)
      .attr("height", 100)
      .attr("id", "gauge1")
      .attr("class", "gauge");
    var svg2 = stpbox.append("svg")
      .attr("width", 70)
      .attr("height", 100)
      .attr("id", "gauge2")
      .attr("class", "gauge");
    var svg3 = stpbox.append("svg")
      .attr("width", 70)
      .attr("height", 100)
      .attr("id", "gauge3")
      .attr("class", "gauge");
    var svg4 = stpbox.append("svg")
      .attr("width", 70)
      .attr("height", 100)
      .attr("id", "gauge4")
      .attr("class", "gauge");

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

    //append a label
    svg1.append("text")
      .text("Totaal")
      .attr("y", 95)
      .attr("x", 15);
    svg2.append("text")
      .text("Optie")
      .attr("y", 95)
      .attr("x", 15);
    svg3.append("text")
      .text("Verdere optie")
      .attr("y", 95)
      .attr("x", 0)
      .style("font-size", "11.6px");
    svg4.append("text")
      .text("AVO")
      .attr("y", 95)
      .attr("x", 20);

    function updateStpbox() {
      // haal alle gekozen vakken
      var chosen1 = hypergraph.selectAll(".chosen-master1").data();
      var chosen2 = hypergraph.selectAll(".chosen-master2").data();
      var chosen = [...chosen1, ...chosen2];
      var option = hypergraph.select(".option-chosen").data()[0].ID;

      // bereken totaal aantal studiepunten
      var total = getTotalStp(chosen);

      var inOption = chosen.filter(function (d) {
        return (0 < d[option]) && (getCourseOptions(d).length < optionNames.length);
      });
      // komt uit verdere optie of uit eigen keuze of andere opties
      var inOptionExtra = chosen.filter(function (d) {
        return d[option] == 0 && (0 < d["Verdere optie"] || (getCourseOptions(d).length < optionNames.length && d["Algemeen vormende en onderzoeksondersteunende groep"] == 0));
      });
      var inAVO = chosen.filter(function (d) {
        return (0 < d["Algemeen vormende en onderzoeksondersteunende groep"]);
      });

      inOption = getTotalStp(inOption);
      inOptionExtra = getTotalStp(inOptionExtra);
      inAVO = getTotalStp(inAVO);
      // overflow binnen eigen optie telt mee voor verdere optie
      if (inOption > 18) inOptionExtra += (inOption - 18);

      gauge1.update(total);
      gauge2.update(inOption);
      gauge3.update(inOptionExtra);
      gauge4.update(inAVO);

    }


  });

});
