const q2gTooltip = d3.select("#tooltip");

const q2gMargin = { top: 50, right: 40, bottom: 100, left: 80 },
      q2gWidth  = 1000 - q2gMargin.left - q2gMargin.right,
      q2gHeight = 420  - q2gMargin.top  - q2gMargin.bottom;

const q2gSvg = d3.select("#q2-grouped")
  .append("svg")
  .attr("width",  q2gWidth  + q2gMargin.left + q2gMargin.right)
  .attr("height", q2gHeight + q2gMargin.top  + q2gMargin.bottom)
  .append("g")
  .attr("transform", `translate(${q2gMargin.left},${q2gMargin.top})`);

const METHODS = ["Camera issued", "Police issued"]; 

const COLOR = d3.scaleOrdinal()
  .domain(METHODS)
  .range(["#E69F00", "#0072B2"]);  // orange, blue

let RAW = [];
let metric = "TOTAL_FINES";
let layout = "grouped";

// Load data
d3.csv("data/mobile_phone_cleaned.csv").then(data => {
  data.forEach(d => {
    d.YEAR                   = +d.YEAR;
    d.TOTAL_FINES            = +d.TOTAL_FINES;
    d.FINES_PER_10K_LICENCES = +d.FINES_PER_10K_LICENCES || 0;
  });

  RAW = data;

  setupYearDropdown();
  setupControls();
  drawChart();
});

/*Dropdown*/
function setupYearDropdown() {
  const select = document.getElementById("q2-year-select");

  const years = [...new Set(RAW.map(d => d.YEAR))].sort();

  let html = "";
  html += `<option value="camera-era" selected>Camera era (2020–2024)</option>`;
  html += `<option value="pre-camera">2008–2019 (police era)</option>`;
  html += `<option value="all-years">All years (2008–2024)</option>`;

  html += `<optgroup label="Single years">`;
  years.forEach(y => html += `<option value="${y}">${y}</option>`);
  html += `</optgroup>`;

  select.innerHTML = html;
}

/* Controls*/
function setupControls() {
  document.querySelectorAll('input[name="q2g-metric"]').forEach(r => {
    r.addEventListener("change", e => {
      metric = e.target.value;
      drawChart();
    });
  });

  document.querySelectorAll('input[name="q2g-layout"]').forEach(r => {
    r.addEventListener("change", e => {
      layout = e.target.value;
      drawChart();
    });
  });

  document.getElementById("q2-year-select").addEventListener("change", drawChart);
}

/* Main Draw Function*/
function drawChart() {
  const periodVal = document.getElementById("q2-year-select").value;

  let filterFn;
  let label;

  if (periodVal === "camera-era") {
    filterFn = d => d.YEAR >= 2020 && d.YEAR <= 2024;
    label = "2020–2024";
  } else if (periodVal === "pre-camera") {
    filterFn = d => d.YEAR <= 2019;
    label = "2008–2019";
  } else if (periodVal === "all-years") {
    filterFn = d => d.YEAR >= 2008 && d.YEAR <= 2024;
    label = "2008–2024";
  } else {
    const yr = +periodVal;
    filterFn = d => d.YEAR === yr;
    label = yr;
  }

  const filtered = RAW.filter(filterFn);

  const states = [...new Set(filtered.map(d => d.JURISDICTION))].sort();

  const rows = states.map(j => {
    const row = { state: j };
    METHODS.forEach(m => {
      row[m] = d3.sum(filtered.filter(d =>
        d.JURISDICTION === j && d.DETECTION_METHOD === m
      ), d => d[metric]);
    });
    row.total = METHODS.reduce((s, m) => s + row[m], 0);
    return row;
  });

  rows.sort((a,b) => b.total - a.total);

  /*SCALES*/
  const x0 = d3.scaleBand()
    .domain(rows.map(r => r.state))
    .range([0, q2gWidth])
    .padding(0.25);

  const x1 = d3.scaleBand()
    .domain(METHODS)
    .range([0, x0.bandwidth()])
    .padding(0.15);

  const maxY = layout === "stacked"
    ? d3.max(rows, r => r.total)
    : d3.max(rows, r => d3.max(METHODS, m => r[m]));

  const y = d3.scaleLinear()
    .domain([0, maxY]).nice()
    .range([q2gHeight, 0]);

  /*AXES*/
  q2gSvg.selectAll(".axis").remove();

  q2gSvg.append("g")
    .attr("class", "axis x-axis")
    .attr("transform", `translate(0,${q2gHeight})`)
    .call(d3.axisBottom(x0))
    .selectAll("text")
    .attr("transform", "rotate(-35)")
    .style("text-anchor", "end")
    .style("font-size", "11px");

  q2gSvg.append("g")
    .attr("class", "axis y-axis")
    .call(d3.axisLeft(y).tickFormat(d3.format("~s")));

  /*TITLE LABEL */
  q2gSvg.selectAll(".period-label").remove();
  q2gSvg.append("text")
    .attr("class", "period-label")
    .attr("x", 0)
    .attr("y", -15)
    .attr("fill", "#003366")
    .style("font-weight", "600")
    .text(`Period: ${label}`);

  /* BARS */
  const groups = q2gSvg.selectAll(".bar-group")
    .data(rows, d => d.state)
    .join("g")
    .attr("class", "bar-group")
    .attr("transform", d => `translate(${x0(d.state)},0)`);

  // compute stacking positions
  rows.forEach(r => {
    let acc = 0;
    METHODS.forEach(m => {
      r[m + "_y0"] = acc;
      r[m + "_y1"] = acc + r[m];
      acc += r[m];
    });
  });

  const bars = groups.selectAll("rect")
    .data(d => METHODS.map(m => ({
      state: d.state,
      method: m,
      value: d[m],
      total: d.total,
      y0: d[m + "_y0"],
      y1: d[m + "_y1"]
    })))
    .join(
      enter => enter.append("rect")
        .attr("fill", d => COLOR(d.method))
        .attr("rx", 4)
        .attr("x", d => layout === "grouped" ? x1(d.method) : 0)
        .attr("width", d => layout === "grouped" ? x1.bandwidth() : x0.bandwidth())
        .attr("y", q2gHeight)
        .attr("height", 0)
    )
    .call(updateBars);

  /* TOOLTIP */
  bars
    .on("mousemove", (event, d) => {
      const share = (d.value / d.total * 100).toFixed(1);

      q2gTooltip
        .style("opacity", 1)
        .html(`
          <strong>${d.state} — ${d.method}</strong><br>
          ${metric === "TOTAL_FINES"
            ? d.value.toLocaleString() + " fines"
            : d.value.toFixed(1) + " per 10k"}
          <br>Share: ${share}%
        `)
        .style("left", event.pageX + 12 + "px")
        .style("top", event.pageY - 20 + "px");

      d3.selectAll("#q2-grouped rect").attr("opacity", 0.2);
      d3.select(event.target).attr("opacity", 1);
    })
    .on("mouseout", () => {
      q2gTooltip.style("opacity", 0);
      d3.selectAll("#q2-grouped rect").attr("opacity", 1);
    });

  /*UPDATE BARS */
  function updateBars(sel) {
    sel.transition()
      .duration(600)
      .attr("x", d => layout === "grouped" ? x1(d.method) : 0)
      .attr("width", d => layout === "grouped" ? x1.bandwidth() : x0.bandwidth())
      .attr("y", d => layout === "grouped" ? y(d.value) : y(d.y1))
      .attr("height", d => layout === "grouped"
        ? q2gHeight - y(d.value)
        : y(d.y0) - y(d.y1)
      )
      .attr("stroke", "#fff")
      .attr("stroke-width", 1);
  }
}
