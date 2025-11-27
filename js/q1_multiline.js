/* Q1 MULTILINE */

const q1Margin = { top: 40, right: 120, bottom: 60, left: 70 },      q1Width  = 1000 - q1Margin.left - q1Margin.right,
      q1Height = 420 - q1Margin.top - q1Margin.bottom;

const q1Svg = d3.select("#q1-multiline")
  .append("svg")
  .attr("width", q1Width + q1Margin.left + q1Margin.right)
  .attr("height", q1Height + q1Margin.top + q1Margin.bottom)
  .append("g")
  .attr("transform", `translate(${q1Margin.left},${q1Margin.top})`);

const q1Tooltip = d3.select("#tooltip");

let q1Data, states, x, y, color;
let q1Metric = "TOTAL_FINES";
let q1View = "all";
let q1Single = null;

// Track legend visibility
let legendVisible = {};

d3.csv("data/mobile_phone_cleaned.csv").then(raw => {

  raw.forEach(d => {
    d.YEAR = +d.YEAR;
    d.TOTAL_FINES = +d.TOTAL_FINES || 0;
    d.LICENCE_TOTAL = +d.LICENCE_TOTAL || 0;
  });

  // Aggregate (unchanged)
  const aggregated = Array.from(
    d3.rollup(
      raw,
      v => {
        const totalFines = d3.sum(v, d => d.TOTAL_FINES);
        const totalLic   = d3.sum(v, d => d.LICENCE_TOTAL);
        const per10k     = totalLic ? (totalFines / totalLic) * 10000 : 0;
        return {
          TOTAL_FINES: totalFines,
          FINES_PER_10K_LICENCES: per10k
        };
      },
      d => d.JURISDICTION,
      d => d.YEAR
    ),
    ([state, yearMap]) =>
      Array.from(yearMap, ([year, vals]) => ({
        JURISDICTION: state,
        YEAR: +year,
        TOTAL_FINES: vals.TOTAL_FINES,
        FINES_PER_10K_LICENCES: vals.FINES_PER_10K_LICENCES
      }))
  ).flat();

  q1Data = aggregated;
  states = [...new Set(q1Data.map(d => d.JURISDICTION))];

  // Init legend visibility
  states.forEach(s => legendVisible[s] = true);

  setupUI();
  setupChart();
  createLegend();
  drawChart();
});


/* ---------------- UI SETUP ---------------- */
function setupUI() {

  document.querySelectorAll('input[name="metricQ1"]').forEach(r => {
    r.addEventListener("change", e => {
      q1Metric = e.target.value;
      drawChart();
    });
  });

  document.getElementById("q1-view").addEventListener("change", e => {
    q1View = e.target.value;

    document.getElementById("q1-state-select").style.display =
      q1View === "single" ? "inline-block" : "none";

    drawChart();
  });

  const sel = document.getElementById("q1-state-select");
  states.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  });

  sel.addEventListener("change", e => {
    q1Single = e.target.value;
    drawChart();
  });
}



/* ---------------- INITIAL CHART SETUP ---------------- */
function setupChart() {
  x = d3.scaleLinear()
    .domain(d3.extent(q1Data, d => d.YEAR))
    .range([0, q1Width]);

  y = d3.scaleLinear().range([q1Height, 0]);

  color = d3.scaleOrdinal()
    .domain(states)
    .range(d3.schemeTableau10);

  q1Svg.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${q1Height})`);

    q1Svg.append("g").attr("class", "y-axis");

    // Add Y-axis label
    q1Svg.append("text")
      .attr("class", "y-axis-label")
      .attr("transform", "rotate(-90)")
      .attr("y", -50)
      .attr("x", -(q1Height / 2))
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .attr("font-weight", "600")
      .attr("fill", "#003366")
      .text("Total Fines");
    
    // Add X-axis label
    q1Svg.append("text")
      .attr("class", "x-axis-label")
      .attr("x", q1Width / 2)
      .attr("y", q1Height + 35)
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .attr("font-weight", "600")
      .attr("fill", "#003366")
      .text("Year");
    
    q1Svg.append("line")
    .attr("class", "hover-line")
    .attr("stroke", "#003366")
    .attr("stroke-width", 1.2)
    .attr("y1", 0)
    .attr("y2", q1Height)
    .style("opacity", 0);
}



/* ---------------- LEGEND ---------------- */
function createLegend() {
  const legend = d3.select("#q1-legend");
  legend.html(""); // clear old legend

  const items = legend.selectAll(".legend-item")
    .data(states)
    .enter()
    .append("div")
    .attr("class", "legend-item")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "6px")
    .style("cursor", "pointer")
    .on("click", (event, state) => {
      legendVisible[state] = !legendVisible[state];
      updateLegendOpacity();
      drawChart();
    });

  items.append("div")
    .attr("class", "legend-color")
    .style("width", "14px")
    .style("height", "14px")
    .style("background", d => color(d));

  items.append("span")
    .attr("class", "legend-label")
    .text(d => d);

  updateLegendOpacity();
}

function updateLegendOpacity() {
  d3.select("#q1-legend")
    .selectAll(".legend-item")
    .style("opacity", d => legendVisible[d] ? 1 : 0.3);
}

/* ---------------- DRAW CHART ---------------- */
function drawChart() {

  let filtered = q1Data;

  if (q1View === "single" && q1Single) {
    filtered = filtered.filter(d => d.JURISDICTION === q1Single);
  }

  if (q1View === "top3") {
    const totals = d3.rollup(filtered, v=>d3.sum(v,d=>d[q1Metric]), d=>d.JURISDICTION);
    const top3 = Array.from(totals.entries())
      .sort((a,b)=>b[1]-a[1])
      .slice(0,3)
      .map(d=>d[0]);
    filtered = filtered.filter(d => top3.includes(d.JURISDICTION));
  }

  if (q1View === "bottom3") {
    const totals = d3.rollup(filtered, v=>d3.sum(v,d=>d[q1Metric]), d=>d.JURISDICTION);
    const bot3 = Array.from(totals.entries())
      .sort((a,b)=>a[1]-b[1])
      .slice(0,3)
      .map(d=>d[0]);
    filtered = filtered.filter(d => bot3.includes(d.JURISDICTION));
  }

  y.domain([0, d3.max(filtered, d => d[q1Metric])]).nice();

  q1Svg.select(".y-axis")
    .transition().duration(500)
    .call(d3.axisLeft(y));

  q1Svg.select(".x-axis")
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  const nested = d3.group(filtered, d => d.JURISDICTION);

  const line = d3.line()
    .curve(d3.curveMonotoneX)
    .x(d => x(d.YEAR))
    .y(d => y(d[q1Metric]));

  const paths = q1Svg.selectAll(".line-series")
    .data(
      Array.from(nested).filter(([state]) => legendVisible[state]),
      d=>d[0]
    );

  paths.enter()
    .append("path")
    .attr("class","line-series")
    .attr("fill","none")
    .attr("stroke-width",2)
    .attr("stroke",d=>color(d[0]))
    .attr("d",d=>line(d[1].sort((a,b)=>a.YEAR-b.YEAR)))
    .attr("stroke-dasharray", function(){return this.getTotalLength();})
    .attr("stroke-dashoffset", function(){return this.getTotalLength();})
    .transition().duration(1500)
    .attr("stroke-dashoffset",0);

  paths.transition().duration(700)
    .attr("stroke",d=>color(d[0]))
    .attr("d",d=>line(d[1].sort((a,b)=>a.YEAR-b.YEAR)));

  paths.exit().remove();

  addHover(nested);
}



/* ---------------- HOVER / TOOLTIP ---------------- */
function addHover(nested) {
  const hoverLine = q1Svg.select(".hover-line");

  q1Svg.on("mousemove", e => {
    const [mx] = d3.pointer(e);
    const year = Math.round(x.invert(mx));
    if (year < 2008 || year > 2024) return;

    hoverLine.attr("x1", mx).attr("x2", mx).style("opacity", 1);

    const rows = Array.from(nested)
      .filter(([state]) => legendVisible[state])
      .map(([state, arr]) => {
        const r = arr.find(v=>v.YEAR===year);
        return r ? {state, value:r[q1Metric]} : null;
      })
      .filter(Boolean)
      .sort((a,b)=>b.value-a.value);

    /* ===========================================
        ANNOTATION TEXT FOR 2020/2021
    ============================================ */

    let annotation = "";

    if (year === 2020) {
      annotation = `
        <br><br>
        <strong style="color:#b30059;">
          Camera enforcement introduced in 2020
        </strong>
        <br>
        <strong style="color:#003366;">
          COVID-19 impact period (2020–2021)
        </strong>
      `;
    } else if (year === 2021) {
      annotation = `
        <br><br>
        <strong style="color:#003366;">
          COVID-19 impact period (2020–2021)
        </strong>
      `;
    }

    q1Tooltip.style("opacity", 1)
      .html(`
        <strong>${year}</strong><br>
        ${rows.map(i =>
          `<span style="color:${color(i.state)}">
              ${i.state}
            </span>: 
            ${i.value.toLocaleString()}`
        ).join("<br>")}
        ${annotation}
      `)
      .style("left",(e.pageX+15)+"px")
      .style("top",(e.pageY-20)+"px");
  });

  q1Svg.on("mouseleave", () => {
    hoverLine.style("opacity",0);
    q1Tooltip.style("opacity",0);
  });
}
