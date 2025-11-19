const q1Margin = { top: 40, right: 180, bottom: 40, left: 60 },
      q1Width  = 1000 - q1Margin.left - q1Margin.right,
      q1Height = 420 - q1Margin.top - q1Margin.bottom;

const q1Svg = d3.select("#q1-multiline")
  .append("svg")
  .attr("width", q1Width + q1Margin.left + q1Margin.right)
  .attr("height", q1Height + q1Margin.top + q1Margin.bottom)
  .append("g")
  .attr("transform", `translate(${q1Margin.left},${q1Margin.top})`);

const q1Tooltip = d3.select("#tooltip");

let q1Data, jurisdictions, x, y, color;

// NEW STATE VARIABLES ⭐
let q1Metric = "TOTAL_FINES";
let q1ViewMode = "all";         // all | top3 | bottom3 | single
let q1SelectedState = null;

// ---------------- LOAD DATA ----------------
d3.csv("data/mobile_phone_cleaned.csv").then(raw => {
  raw.forEach(d => {
    d.YEAR = +d.YEAR;
    d.TOTAL_FINES = +d.TOTAL_FINES;
    d.FINES_PER_10K_LICENCES = +d.FINES_PER_10K_LICENCES || 0;
  });

  q1Data = raw;
  jurisdictions = [...new Set(q1Data.map(d => d.JURISDICTION))];

  setupUI();       
  setupChart();
  drawChart();    
});

// ---------------- UI SETUP ----------------
function setupUI() {
  // populate "single state" selector
  const singleSel = d3.select("#q1-state-select");
  jurisdictions.forEach(s => {
    singleSel.append("option").attr("value", s).text(s);
  });

  // Metric selector
  document.querySelectorAll('input[name="metricQ1"]').forEach(r => {
    r.addEventListener("change", e => {
      q1Metric = e.target.value;
      drawChart();
    });
  });

  // View selector
  document.getElementById("q1-view").addEventListener("change", e => {
    q1ViewMode = e.target.value;

    if (q1ViewMode === "single") {
      document.getElementById("q1-state-select").style.display = "inline-block";
    } else {
      document.getElementById("q1-state-select").style.display = "none";
    }

    drawChart();
  });

  // Single jurisdiction selection
  document.getElementById("q1-state-select").addEventListener("change", e => {
    q1SelectedState = e.target.value;
    drawChart();
  });
}

function setupChart() {
  x = d3.scaleLinear()
    .domain(d3.extent(q1Data, d => d.YEAR))
    .range([0, q1Width]);

  y = d3.scaleLinear().range([q1Height, 0]);

  color = d3.scaleOrdinal().domain(jurisdictions).range(d3.schemeTableau10);

  q1Svg.append("g").attr("class", "x-axis")
    .attr("transform", `translate(0,${q1Height})`);

  q1Svg.append("g").attr("class", "y-axis");

  q1Svg.append("g").attr("class", "brush");

  q1Svg.append("line")
    .attr("class", "hover-line")
    .attr("stroke", "#007acc")
    .attr("stroke-width", 1.8)
    .attr("y1", 0)
    .attr("y2", q1Height)
    .style("opacity", 0);
}


function drawChart() {
  let filtered = q1Data;

  if (q1ViewMode === "single") {
    filtered = filtered.filter(d => d.JURISDICTION === q1SelectedState);
  }

  if (q1ViewMode === "top3") {
    const totals = d3.rollup(filtered, v => d3.sum(v, d => d[q1Metric]), d => d.JURISDICTION);
    const top3 = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(d => d[0]);
    filtered = filtered.filter(d => top3.includes(d.JURISDICTION));
  }

  if (q1ViewMode === "bottom3") {
    const totals = d3.rollup(filtered, v => d3.sum(v, d => d[q1Metric]), d => d.JURISDICTION);
    const bottom3 = Array.from(totals.entries()).sort((a, b) => a[1] - b[1]).slice(0, 3).map(d => d[0]);
    filtered = filtered.filter(d => bottom3.includes(d.JURISDICTION));
  }

  
  const maxY = d3.max(filtered, d => d[q1Metric]) || 1;
  y.domain([0, maxY]).nice();

  q1Svg.select(".y-axis").transition().duration(600).call(d3.axisLeft(y));
  q1Svg.select(".x-axis").call(d3.axisBottom(x).tickFormat(d3.format("d")));

  
  const nested = d3.group(filtered, d => d.JURISDICTION);

  const lineGen = d3.line()
    .curve(d3.curveMonotoneX)
    .x(d => x(d.YEAR))
    .y(d => y(d[q1Metric]));

  const paths = q1Svg.selectAll(".line-series")
    .data(nested, d => d[0]);

  paths.enter()
    .append("path")
    .attr("class", "line-series")
    .attr("stroke", d => color(d[0]))
    .attr("fill", "none")
    .attr("stroke-width", 2)
    .attr("d", d => lineGen(d[1]))
    .attr("stroke-dasharray", function () { return this.getTotalLength(); })
    .attr("stroke-dashoffset", function () { return this.getTotalLength(); })
    .transition().duration(2000)
    .attr("stroke-dashoffset", 0);

  paths.transition().duration(900)
    .attr("d", d => lineGen(d[1]));

  paths.exit().remove();

  // 5️⃣ REACTIVATE INTERACTIVITY
  addHoverEffects(nested);
  addBrushing();
}

function addHoverEffects(nestedMap) {
  const hoverLine = q1Svg.select(".hover-line");

  q1Svg.on("mousemove", (event) => {
    const [mx] = d3.pointer(event);
    const year = Math.round(x.invert(mx));

    if (year < 2008 || year > 2024) return;

    hoverLine.attr("x1", mx).attr("x2", mx).style("opacity", 1);

    const values = Array.from(nestedMap).map(([state, arr]) => {
      const entry = arr.find(d => d.YEAR === year);
      return entry ? { state, value: entry[q1Metric] } : null;
    }).filter(Boolean);

    const avg = d3.mean(values, d => d.value);

    q1Tooltip.style("opacity", 1)
      .html(`
        <strong>${year}</strong><br>
        <em>National avg:</em> ${avg.toFixed(1)}<br><br>
        ${values.map(v =>
          `<span style="color:${color(v.state)}">${v.state}</span>: ${v.value.toLocaleString()}`
        ).join("<br>")}`)
      .style("left", (event.pageX + 15) + "px")
      .style("top", (event.pageY - 20) + "px");
  });

  q1Svg.on("mouseleave", () => {
    hoverLine.style("opacity", 0);
    q1Tooltip.style("opacity", 0);
  });
}

function addBrushing() {
  const brush = d3.brushX()
    .extent([[0, 0], [q1Width, q1Height]])
    .on("end", event => {
      if (!event.selection) return;
      const [x0, x1] = event.selection;
      x.domain([Math.round(x.invert(x0)), Math.round(x.invert(x1))]);
      q1Svg.select(".brush").call(brush.move, null);
      drawChart();
    });

  q1Svg.select(".brush").call(brush);
}
