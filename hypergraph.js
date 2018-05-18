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

// variabelen Infobox
var optionChosen = false;
var stpSize = optionRadius * 2;

// maak een svg voor de hypergraf
hypergraph.attr("width", svgWidth)
  .attr("height", svgHeight);

// tooltip aanmaken (inhoud wordt ingevuld bij hover over bolletje)
var tooltip = hypergraphContainer.append("div")
  .attr("class", "tooltip");

// switch standaard uitschakelen
switchInterested.property("checked", false);

d3.csv("cw-6.csv").then(function (data) {
  d3.csv("uniekeReserveringen.csv").then(function (scheduleData) {
    // namen van alle opties
    var columnNames = d3.keys(d3.values(data)[0]);
    var optionNames = columnNames.slice(13, columnNames.length);

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

     hypergraph.on("click", function() {
       backgroundClicked();
     });

     function backgroundClicked() {
       var activeCourse = hypergraph.select(".course-node.active");
       if (!activeCourse.empty()) {
         emptyInfobox();
         resizeCourseNode(activeCourse, 2 / 3);
         toggleHighlightCourse(activeCourse.datum());
         toggleActive(activeCourse);
       }
       else {
         var activeOption = hypergraph.select(".option-node.active");
         if (!activeOption.empty()) {
           emptyInfobox();
           toggleHighlightOption(activeOption.datum());
           toggleActive(activeOption);
         }
       }
     }

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
          d3.event.stopPropagation();
          if (isActive(d3.select(this))) {
            emptyInfobox();
            toggleActive(d3.select(this));
            // opmerking: de optie blijft gehighlightet tot de mouseout
          } else if (!activeNodeExists()) {
            toggleActive(d3.select(this));
            fillInfoboxForOption(d);
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
      d3.event.stopPropagation();
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
      var chosenOptionActive = !hypergraph.select(".option-chosen.active").
        empty();
      if (!optionChosen || chosenOptionActive) {
        var checkbox = infobox.append("label")
          .text("Kies deze optie");
        checkbox.attr("class", "radiobutton checkbox-chooseoption")
          .append("input")
          .attr("type", "checkbox")
          .attr("name", "checkbox")
          .property("checked", chosenOptionActive);
        checkbox.append("span")
          .attr("class", "checkmark");
        checkbox.on("change", toggleOptionChosen);
      }
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

    function toggleOptionChosen() {
      optionChosen = !optionChosen;
      var activeOptionNode = hypergraph.select(".option-node.active");
      activeOptionNode.node().classList.toggle("option-chosen");
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
        .attr("x", d => (size / 2) * (2 - d.Semester));
    }

    // voeg inhoud voor het gegeven vak toe aan de infobox
    function fillInfoboxForCourse(course) {
      emptyInfobox();
      var c = course.datum();
      // 1) titel van het actieve vak
      infobox.append("h3").text(c.OPO);
      // 2) studiepunten van het actieve vak
      infobox.append("div")
        .attr("class", "points")
        .text(c.Studiepunten + " SP");

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

      infobox.append("p")
        .text(function () {
          return c.Beschrijving;
        });

      // radiobutton "Geïnteresseerd" voor het actieve vak
      var radiobuttonInterested = infobox.append("label")
        .text("Geïnteresseerd in dit vak");
      radiobuttonInterested.attr("class", "radiobutton radiobutton-interested")
        .append("input")
        .attr("type", "radio")
        .attr("name", "radio")
        .attr("value", "interested")
        .property("checked", true);
      radiobuttonInterested.append("span")
        .attr("class", "checkmark");
      radiobuttonInterested.on("change", toggleStatusRadioButtons);

      // radiobutton "Niet geïnteresseerd" voor het actieve vak
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
      } else if (value == "not-interested") {
        toggleStatusNotInterested(course);
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
      updateBarchart();
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
     * Bar chart
     */

    var barSpacing = 3;
    var barHeight = 20;
    var barchartLeftMargin = 90;
    var creditLength = (svgWidth - barchartLeftMargin) / 40;

    barchart.attr("width", svgWidth)
      .attr("height", 4 * barHeight + 3 * barSpacing);
    // barchart.select(".barchart-layout").append("line")
    //   .classed("barchart-line", true)
    //   .attr("x1", creditLength * 30 + barchartLeftMargin)
    //   .attr("y1", 0)
    //   .attr("x2", creditLength * 30 + barchartLeftMargin)
    //   .attr("y2", 100);

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

    // bepaal voor hoeveel studiepunten een vak mee telt in een semester
    function semestrialPoints(d) {
      return (d.Semester == 3) ? d.Studiepunten / 2 : d.Studiepunten;
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

      bars.exit().remove();

      bars.enter()
        .append("rect")
        .attr("class", "rect-sem rect-sem" + semesterNummer)
        .attr("width", d => semestrialPoints(d) * creditLength - barSpacing)
        .attr("height", barHeight)
        .attr("rx", 4)
        .attr("ry", 4)
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
      barchart.select(".bar-label" + semesterNummer).remove();
      if (semesterTotal !== 0) {
        barchart.append("text")
          .attr("class", "barchart-text bar-label" + semesterNummer)
          .attr("x", barchartLeftMargin + semesterTotal * creditLength)
          .attr("y", barHeight * semesterNummer + barSpacing * (semesterNummer - 1) - (barHeight - 10) / 2)
          .text(semesterTotal);
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
