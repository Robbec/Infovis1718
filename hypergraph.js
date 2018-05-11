// variabelen voor de DOM-elementen
var body = d3.select("body");
var left = d3.select(".left");
var right = d3.select(".right");
var hypergraphContainer = left.select(".hypergraph-container");
var barchartContainer = left.select("bargroup-container");
var hypergraph = hypergraphContainer.select(".hypergraph");
var switchInterested = right.select(".switch-interested").select("input");
var infobox = right.select(".infobox");

// globale variabelen voor de opbouw van de hypergraf
var options = [];
var links = [];
var hiddenCourses = [];
var hiddenLinks = [];
var distanceOptionRoot = 30;
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
  .domain([0, 40])
  .range([0, svgWidth]);
var refreshBars;

// variabelen Infobox
var stpSize = optionRadius * 2;

// maak een svg voor de hypergraf
hypergraph.attr("width", svgWidth)
  .attr("height", svgHeight);

// tooltip aanmaken (inhoud wordt ingevuld bij hover over bolletje)
var tooltip = hypergraphContainer.append("div")
  .classed("tooltip", true);
var tooltipBarchart = barchartContainer.append("div")
  .classed("tooltip", true);

// switch standaard uitschakelen
switchInterested.property("checked", false);

d3.csv("cw-6-tijdelijk.csv").then(function (data) {
  d3.csv("uniekeReserveringen.csv").then(function (scheduleData) {
    // namen van alle opties
    var columnNames = d3.keys(d3.values(data)[0]);
    var optionNames = columnNames.slice(12, columnNames.length);

    /**
     * Kleuren
     */

    // kleurenpalet
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
     * Hypergraf
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
      target: o,
      dist: distanceOptionRoot
    }));
    options.push(root);

    // maak voor alle vakken een link met de bijhorende opties
    data.forEach(function (d) {
      var courseOptions = getCourseOptions(d);
      if (courseOptions.length < optionNames.length) {
        courseOptions.forEach(o =>
          links.push({
            "ID": o.ID + d.ID,
            "source": o,
            "target": d,
            "dist": distanceOptionCourse * courseOptions.length
          }));
      }
    });

    updateLinks();

    // updatepatroon voor de links
    function updateLinks() {
      var link = hypergraph.selectAll("line")
        .data(links, l => l.ID);

      link
        .enter()
        .append("line")
        .attr("stroke", l => getOptionColour(l.source))
        .classed("link non-active", true);

      link.exit().remove();
    }

    updateOptionNodes();

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
        .on("click", function (d) {
          if (isActive(d3.select(this))) {
            emptyInfobox();
            toggleActive(d3.select(this));
            // opmerking: de optie blijft gehighlightet tot de mouseout
          } else if (!activeNodeExists()) {
            fillInfoboxForOption(d);
            toggleActive(d3.select(this));
            // opmerking: de optie is al gehighlightet vanwege de hover
          }
        });

      option.exit().remove();
    }

    updateCourseNodes();

    // updatepatroon voor de course nodes
    function updateCourseNodes() {
      var course = hypergraph.selectAll(".course-node")
        .data(data, d => d.ID);

      course.enter()
        .append("circle")
        .attr("r", courseRadius)
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
        .classed("not-interested", switchInterested.property("checked"))
        .attr("fill", function (d) {
          return colorOfCourse(d);
        })
        .attr("stroke", function (d) {
          return colorOfCourse(d);
        })
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
        .on("click", function () {
          courseClicked(d3.select(this));
        });

      course.exit().remove();
    }

    function courseClicked(course) {
      var activeCourse = hypergraph.select(".course-node.active");
      var activeCourseExists = !activeCourse.empty();
      if (isActive(course)) {
        // opmerking: het vak blijft gehighlightet tot de mouseout
        emptyInfobox();
        resizeCourseNode(course, 2 / 3);
        toggleActive(course);
      } else if (activeCourseExists) {
        // opmerking: de highlights voor de betrokken vakken moeten nu aangepast worden
        resizeCourseNode(activeCourse, 2 / 3);
        toggleHighlightCourse(activeCourse.datum());
        toggleActive(activeCourse);
        fillInfoboxForCourse(course);
        resizeCourseNode(course, 1.5);
        toggleHighlightCourse(course.datum());
        toggleActive(course);
      } else {
        // opmerking: de prerequisites zijn al gehighlightet vanwege de hover
        fillInfoboxForCourse(course);
        resizeCourseNode(course, 1.5);
        toggleActive(course);
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

    /**
     * Force simulatie voor de hypergraf
     */

    // force simulation bepaalt de positie van alle nodes
    var forceCollide = d3.forceCollide(courseRadius * 1.3)
      .strength(1)
    // .iterations(3);
    var simulationNodes = d3.forceSimulation(data.concat(options))
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
        // .distance(d => d.dist)
        .strength(0.5)
      )
      // roep ticked() op in elke iteratiestap van de simulatie
      .on("tick", ticked);

    // deze functie wordt opgeroepen in elke iteratiestap van de simulatie
    function ticked() {
      // pas de positie aan van de course nodes
      hypergraph.selectAll(".course-node")
        .attr("cx", d => boxBoundedX(d.x))
        .attr("cy", d => boxBoundedY(d.y));

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
        // .distanceMin(100)
        // .distanceMax(400)
      )
      // laat option nodes zich in een cirkel rond het middelpunt van de hypergraf verdelen
      // .force("radial", d3.forceRadial(100, svgWidth / 2, svgHeight / 2)
      //   .strength(1)
      // )
      // .on("end", fixOptionNodes)
      ;

    // fixeer de positie van de option nodes
    function fixOptionNodes() {
      options.forEach(function (o) {
        o.fx = boxBoundedX(o.x);
        o.fy = boxBoundedY(o.y);
      })
      simulationNodes.nodes(data.concat(options))
    }

    /**
     * Functies met betrekking tot de toestand van nodes in de hypergraf
     */

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

    // vind alle links die in een course node aankomen
    function getCourseLinks(course) {
      return hypergraph.selectAll(".link")
        .filter(l => l.target == course);
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

    // check of er actieve nodes zijn in de graf
    function activeNodeExists() {
      var activeCourseNodes = hypergraph.select(".course-node.active");
      var activeOptionNodes = hypergraph.select(".option-node.active");
      return !activeCourseNodes.empty() || !activeOptionNodes.empty();
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

    /**
     * Functies met betrekking tot de inhoud in de infobox
     */

    // verwijder alle vakgerelateerde inhoud in de infobox
    function emptyInfobox() {
      infobox.select(".help").classed("hidden", true);
      infobox.selectAll(".infobox > *:not(.help)").remove();
    }

    // voeg inhoud over de gegeven optie toe aan de infobox
    function fillInfoboxForOption(o) {
      emptyInfobox();
      infobox.append("h3").text(o.OPO);

      // vind alle vakken van de optie en orden ze alfabetisch
      var courses = data
        .filter(function (d) {
          return (0 < d[o.OPO]) && (getCourseOptions(d).length < optionNames.length);
        })
        .sort(function (a, b) {
          return a.OPO.toLowerCase().localeCompare(b.OPO.toLowerCase());
        });

      updateOptionCourses(o, courses);
    }

    function updateOptionCourses(o, courses) {
      var ul = infobox.append("ul").attr("class", "coursesList");

      var li = ul.selectAll(li)
        .data(courses, d => d.ID);

      var liEnter = li.enter()
        .append("li")
        .text(d => d.OPO)
        .on("mouseover", function (d) {
          toggleHighlightOption(o);
          toggleHighlightConnectedOptions(d);
          toggleHighlightCourseLinks(d);
          toggleHighlightPrerequisites(d);
        })
        .on("mouseout", function (d) {
          toggleHighlightOption(o);
          toggleHighlightConnectedOptions(d);
          toggleHighlightCourseLinks(d);
          toggleHighlightPrerequisites(d);
        })
        .on("click", function (d) {
          var course = hypergraph.selectAll(".course-node")
            .filter(c => c == d);
          courseClicked(course);
          toggleActive(hypergraph.select(".option-node.active"));
        });

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
        .classed("not-interested", switchInterested.property("checked"))
        .attr("fill", colors[options.indexOf(o)])
        .attr("stroke", colors[options.indexOf(o)]);

      svg.append("rect")
        .attr("class", "semester-rect")
        .attr("height", size)
        .attr("width", size / 2)
        .attr("fill", "white")
        .attr("x", d => (size / 2) * (d.Semester - 1));
    }

    // voeg inhoud voor het gegeven vak toe aan de infobox
    function fillInfoboxForCourse(course) {
      emptyInfobox();
      var c = course.datum();
      // 1) titel van het actieve vak
      infobox.append("h3").text(c.OPO);

      // 2) studiepunten van het actieve vak
      infobox.append("div")
        .attr("class", "points");
      //.text(course.Studiepunten + " SP");

      var stpContainer = infobox.select(".points");
      stpContainer.append("svg")
        .attr("class", "stp");
      var stp = stpContainer.select(".stp");

      // x position
      var x = 0;
      var projectStp = course.Project;
      // als het vak een project deel heeft
      if (projectStp > 0) {
        // een vierkantje voor elk geheel projectdeel
        var floorProjectStp = Math.floor(projectStp);
        for (i = 0; i < floorProjectStp; i++) {
          stp.append("rect")
            .attr("x", x)
            .attr("width", stpSize)
            .attr("height", stpSize)
            .attr("fill", kulBlue);
          x += stpSize + 1;
        }
        // een rechthoekje in verhouding met het niet gehele projectdeel
        var afterPoint = projectStp - floorProjectStp;
        if (afterPoint > 0) {
          var extraWidth = stpSize * afterPoint;
          stp.append("rect")
            .attr("x", x)
            .attr("width", extraWidth)
            .attr("height", stpSize)
            .attr("fill", kulBlue);
          x += extraWidth + 1;
        }
      }

      var examStp = course.Examen;
      //als het vak een examendeel heeft
      if (examStp > 0) {
        // een rechthoekje in verhouding met het niet gehele examen deel
        // eerst zodat dit past bij het niet gehele projectdeel
        var floorExamStp = Math.floor(examStp);
        var afterPoint = examStp - floorExamStp;
        if (afterPoint > 0) {
          var extraWidth = stpSize * afterPoint;
          stp.append("rect")
            .attr("x", x)
            .attr("width", extraWidth)
            .attr("height", stpSize)
            .attr("fill", kulOrange);
          x += extraWidth + 1;
        }
        // een vierkantje voor elk geheel examen deel
        for (i = 0; i < floorExamStp; i++) {
          stp.append("rect")
            .attr("x", x)
            .attr("width", stpSize)
            .attr("height", stpSize)
            .attr("fill", kulOrange);
          x += stpSize + 1;
        }
      }

      // 3) radiobutton "Niet geïnteresseerd" voor het actieve vak
      var radiobuttonInterested = infobox.append("label")
        .text("Niet geïnteresseerd in dit vak");
      radiobuttonInterested.attr("class", "radiobutton radiobutton-interested")
        .append("input")
        .attr("type", "radio")
        .attr("name", "radio")
        .attr("value", "interested")
        .property("checked", course.classed("not-interested") || course.classed("is-not-interested"));
      radiobuttonInterested.append("span")
        .attr("class", "checkmark");
      radiobuttonInterested.on("change", toggleStatusRadioButtons);

      // 4) radiobutton "Kies in 1ste Master" voor het actieve vak
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

      // 5) radiobutton "Kies in 2de Master" voor het actieve vak
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

    // vind alle option nodes die verbonden zijn met de gegeven course
    function getCourseOptions(course) {
      var courseOptions = [];
      options.forEach(function (o) {
        if (course[o.ID] > 0) {
          courseOptions.push(o);
        }
      });
      return courseOptions;
    }

    /**
    * Functies met betrekking tot de radiobuttonen
    */

    function toggleStatusRadioButtons() {
      var radioButton = d3.select(this);
      var course = hypergraph.select(".course-node.active");
      var value = radioButton.select("input").node().value;
      if (value == "interested") {
        toggleStatusInterested(course);
        course.classed("chosen-master1", false);
        course.classed("chosen-master2", false);
      } else if (value == "choose1") {
        course.classed("not-interested", false);
        course.node().classList.toggle("chosen-master1");
        course.classed("chosen-master2", false);
      } else if (value == "choose2") {
        course.classed("not-interested", false);
        course.classed("chosen-master1", false);
        course.node().classList.toggle("chosen-master2");
      }
      drawHorizontalBar();
    }

    function toggleStatusInterested(course) {
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
        toggleHighlightCourse(c);
        emptyInfobox();
        updateHypergraph();
      }
    }

    switchInterested.on("change", function () {
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
        emptyInfobox();
        updateHypergraph();
      }
    });

    function updateHypergraph() {
      updateLinks();
      updateOptionNodes();
      updateCourseNodes();
      simulationNodes.alpha(0.5).restart();
      simulationOptionNodes.alpha(0.5).restart();
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

    var spacing = 25;
    var height = 20;
    var xOffset = 90;
    var firstClick = true;

    var creditLength = (svgWidth - xOffset) / 40;
    var barGroup = d3.select(".bargroup")
    barGroup.attr("width", svgWidth);
    barGroup.select(".barchart-layout").append("line")
      .classed("barchart-line", true)
      .attr("x1", creditLength * 30 + xOffset)
      .attr("y1", 0)
      .attr("x2", creditLength * 30 + xOffset)
      .attr("y2", 100);


    function drawHorizontalBar() {
      if(firstClick){
        firstClick = false;
        barGroup.select(".barchart-layout").attr("visibility", "visible");
      }

      var m1 = d3.selectAll(".chosen-master1").data();
      var m2 = d3.selectAll(".chosen-master2").data();
      x.domain([0, 40]).nice();

      var s1 = m1.filter(c => c.Semester == 1);
      var s2 = m1.filter(c => c.Semester == 2);
      var b1 = m1.filter(c => c.Semester == 3);
      b1.forEach(c => {
        s1.push({ ...c, Studiepunten: c.Studiepunten / 2 });
        s2.push({ ...c, Studiepunten: c.Studiepunten / 2 });
      });
      var s3 = m2.filter(c => c.Semester == 1);
      var s4 = m2.filter(c => c.Semester == 2);
      var b2 = m2.filter(c => c.Semester == 3);
      b2.forEach(c => {
        s3.push({ ...c, Studiepunten: c.Studiepunten / 2 });
        s4.push({ ...c, Studiepunten: c.Studiepunten / 2 });
      });

      s1 = s1.sort(function (a, b) {
        return a.Studiepunten > b.Studiepunten
      });
      S2 = s2.sort(function (a, b) {
        return a.Studiepunten > b.Studiepunten
      });
      s3 = s3.sort(function (a, b) {
        return a.Studiepunten > b.Studiepunten
      });
      S4 = s4.sort(function (a, b) {
        return a.Studiepunten > b.Studiepunten
      });

      var sems = [s1, s2, s3, s4];

      drawBar(s1, 0);
      drawBar(s2, 1);
      drawBar(s3, 2);
      drawBar(s4, 3);

      function drawBar(data, index) {

        var stack = d3.stack([data])
          .keys(function (d) {
            var keys = [];
            for (var i = 0; i < d[0].length; i++)
              keys.push(i);
            return keys;
          })
          .value(function (d, key) {
            return d[key].Studiepunten
          });

        var bars = barGroup
          .selectAll(".rect-sem" + index)
          .data(stack([data]));

        bars.exit().remove(); //remove courses no longer selected
        bars.enter().append("rect") // add new rect for every newly selected course
          .classed("rect-sem" + index, true)
          .classed("rect-sem", true)
          .on("mouseover", function (d, i) {
            //showTooltip(d);
            if (!activeNodeExists()) {
              toggleHighlightCourse(d[0].data[i]);
            }
          })
          .on("mouseout", function (d, i) {
            //hideTooltip();
            if (!activeNodeExists()) {
              toggleHighlightCourse(d[0].data[i]);
            }
          })
          .on("click", function (d, i) {
            // zoek de node die overeenkomt met de bar
            var cn = d3.selectAll(".node").filter(function (node, index) {
              if (node == undefined)
                return false;
              return node.ID == d[0].data[i].ID;
            })
            // functie verwacht de overeenkomstige node om te kijken of die actief is
            courseClicked(cn)
          });

        bars = barGroup
          .selectAll(".rect-sem" + index)
          .data(stack([data]));

        bars.transition() // update all rects to new positions
          .duration(500)
          .attr("x", function (d) {
            return creditLength * d[0][0] + xOffset;
          })
          .attr("y", spacing * index)
          .attr("width", function (d) { return creditLength * (d[0][1] - d[0][0]) })
          .attr("height", height)
          .attr("rx", 5)
          .attr("ry", 5)
          .attr("fill", function (d, i) { return colorOfCourse(d[0].data[i]) });
      }

    }
  });
});

/**
 * Overige functies
 */

// bound the given x coordinate to the visible part of the hypergraph
function boxBoundedX(x) {
  return Math.max(courseRadius + 2.5, Math.min(svgWidth - courseRadius - 2.5, x));
}

// bound the given y coordinate to the visible part of the hypergraph
function boxBoundedY(y) {
  return Math.max(courseRadius + 2.5, Math.min(svgHeight - courseRadius - 2.5, y));
}
