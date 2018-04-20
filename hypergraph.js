var left = d3.select(".left");
var right = d3.select(".right");
var hypergraphContainer = left.select(".hypergraph-container");
var hypergraph = left.select(".hypergraph");
var infobox = right.select(".infobox");

var width = 500;
var height = 500;
var xo = 250;
var yo = 250;
hypergraph.attr("width", width)
  .attr("height", height);

var kulBlue = "#1d8db0";

// tooltip aanmaken (inhoud wordt ingevuld bij hover over bolletje)
var tooltip = hypergraphContainer.append("div")
  .classed("tooltip", true);

// voorlopig enkel de 6 opties (gebruikt voor indexering)
// var options = ["Artificiele intelligentie", "Computationele informatica", "Gedistribueerde systemen", "Mens-machine communicatie", "Software engineering", "Veilige software", "Verdere optie", "Masterproef", "AVO"];

// kleurenpalet aan opties koppelen
// colors = d3.schemeCategory10;
// var optionColors = {};
// options.forEach((key, idx) => optionColors[key] = colors[idx]);

d3.csv("cw-4.csv").then(function (data) {
  var columnNames = Object.keys(d3.values(data)[0]);
  var options = columnNames.slice(8, columnNames.length - 1);

  // kleurenpalet aan opties koppelen
  // colorbrew colors
  var colors = ['#b2df8a','#33a02c','#fb9a99','#e31a1c','#fdbf6f','#ff7f00','#cab2d6','#6a3d9a','#ffff99','#b15928','#a6cee3','#1f78b4'];
  var optionColors = {};
  options.forEach((key, idx) => optionColors[key] = colors[idx]);

  function getFillColor(d) {
    return kulBlue;
  }

  function colorOfCourse(d) {
    //default kul-blauw
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
    // i = 0;
    // while (i < options.length && color == kulBlue) {
    //   if (d[options[i]] == 2) {
    //     color = optionColors[options[i]];
    //   }
    //   i++
    // }
    return color;
  }

  var links = [];
  var comboNodes = [];

  // create links based on options
  data.forEach(d => {
    var ops = [];
    options.forEach(o => {
      if (d[o] == 1 || d[o] == 2) {
        ops.push(o);
      }
    })
    if (ops.length == 1) {
      // course belongs to only one option
      links.push({
        source: data.length + options.indexOf(ops[0]),
        target: data.indexOf(d),
        dist: 15
      });
    } else if (ops.length > 1) {
      // course belongs to more than one option
      comboName = ops.toString();
      if (comboNodes.indexOf(comboName) == -1) {
        comboNodes.push(comboName);
        ops.forEach(o => {
          links.push({
            source: data.length + options.indexOf(o),
            target: data.length + options.length + comboNodes.indexOf(comboName),
            dist: 45
          });
        });
      }
      links.push({
        source: data.length + options.length + comboNodes.indexOf(comboName),
        target: data.indexOf(d),
        dist: 15
      });
    }
  });
  console.log(links);
  // nodes zijn data en opties

  var extraNodes = [];
  options.forEach(o => extraNodes.push({ ID: o, OPO: o }));
  comboNodes.forEach(n => extraNodes.push({ ID: n, OPO: n }));
  var nodes = [...data, ...extraNodes];

  // force simulation bepaalt positie
  var simulation = d3.forceSimulation(nodes)
    .force("charge", d3.forceManyBody())
    .force("collide", d3.forceCollide(11))
    .force("link", d3.forceLink(links).distance(function (l) { return l.dist }).strength(2))
    .force("x", d3.forceX(xo).strength(.08))
    .force("y", d3.forceY(yo).strength(.08))
    .force("center", d3.forceCenter(xo, yo))
    .on("tick", refresh);

  // for (var j = 0; j < options.length; j++) {
  // var optionGroup = hypergraph.append("g")
  // .classed("optionGroup", true);
  // var option = optionGroup.append("circle")
  // .classed("option", true);
  // var coursesGroup = optionGroup.append("g");
  // var courses = data.filter(function (d, i) {
  // return d[options[j]] == 1;
  // });
  // for (var k = 0; k < courses.length; k++) {
  // coursesGroup.append("circle")
  // .attr("r", 10);
  // };
  // };

  var lines = hypergraph.selectAll("line")
    .data(links);

  lines.enter()
    .append("line")
    .attr("x1", l => l.source.x)
    .attr("y1", l => l.source.y)
    .attr("x2", l => l.target.x)
    .attr("y2", l => l.target.y)
    .classed("link", true);

  // bind de cirkels in de hypergraph aan de data
  var course = hypergraph.selectAll("circle")
    .data(nodes);

  course.enter()
    .append("circle")
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
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



  function refresh() {

    hypergraph.selectAll("line")
      .data(links)
      .attr("x1", l => l.source.x)
      .attr("y1", l => l.source.y)
      .attr("x2", l => l.target.x)
      .attr("y2", l => l.target.y);

    hypergraph.selectAll("circle")
      .data(nodes)
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);

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
