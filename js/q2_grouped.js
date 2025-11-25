/**********************
   Q2 – CLEAN GROUPED BAR CHART
**********************/

const q2gTooltip = d3.select("#tooltip");

// Layout + sizing
const margin = { top: 55, right: 40, bottom: 80, left: 80 },
      width  = 1000 - margin.left - margin.right,
      height = 420  - margin.top  - margin.bottom;

const svg = d3.select("#q2-grouped")
  .append("svg")
  .attr("width",  width  + margin.left + margin.right)
  .attr("height", height + margin.top  + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const METHODS = ["Police issued", "Camera issued"];

const COLORS = {
  "Police issued": "#0072B2",
  "Camera issued": "#E69F00",
};

let RAW = [];
let metric = "TOTAL_FINES";
let layout = "grouped"; // grouped or stacked

/*LOAD DATA*/
d3.csv("data/mobile_phone_cleaned.csv").then(data => {
  data.forEach(d => {
    d.YEAR = +d.YEAR;
    d.TOTAL_FINES = +d.TOTAL_FINES;
    d.FINES_PER_10K_LICENCES = +d.FINES_PER_10K_LICENCES || 0;
  });

  RAW = data;

  setupDropdown();
  setupControls();
  drawChart();
});

/* BUILD YEAR DROPDOWN*/
function setupDropdown() {
  const select = document.getElementById("q2-year-select");

  const years = [...new Set(RAW.map(d => d.YEAR))].sort();

  let html = `
    <option value="all" selected>All years (2008–2024)</option>
    <option value="camera-era">Camera era (2020–2024)</option>
    <option value="police-era">Police era (2008–2019)</option>
    <optgroup label="Individual Years">`;

  years.forEach(y => html += `<option value="${y}">${y}</option>`);
  html += `</optgroup>`;

  select.innerHTML = html;
}

/*CONTROLS*/
function setupControls() {
  document.querySelectorAll('input[name="q2g-metric"]').forEach(r =>
    r.addEventListener("change", e => {
      metric = e.target.value;
      drawChart();
    })
  );

  document.querySelectorAll('input[name="q2g-layout"]').forEach(r =>
    r.addEventListener("change", e => {
      layout = e.target.value;
      drawChart();
    })
  );

  document.getElementById("q2-year-select")
    .addEventListener("change", drawChart);
}

/*MAIN DRAW*/
function drawChart() {
  const period = document.getElementById("q2-year-select").value;

  let filterFn;

  if (period === "camera-era") {
    filterFn = d => d.YEAR >= 2020;
  } else if (period === "police-era") {
    filterFn = d => d.YEAR <= 2019;
  } else if (period === "all") {
    filterFn = d => true;
  } else {
    const yr = +period;
    filterFn = d => d.YEAR === yr;
  }

  const filtered = RAW.filter(filterFn);

  const states = [...new Set(filtered.map(d => d.JURISDICTION))].sort();

  // Aggregate by State
  const rows = states.map(state => {
    const row = { state };
    METHODS.forEach(m => {
      row[m] = d3.sum(
        filtered.filter(d =>
          d.JURISDICTION === state && d.DETECTION_METHOD === m
        ),
        d => d[metric]
      );
    });
    row.total = row["Police issued"] + row["Camera issued"];
    return row;
  });

  // Sort highest → lowest
  rows.sort((a,b) => b.total - a.total);

  // Clear previous
  svg.selectAll("*").remove();

  /* SCALES */
  const x0 = d3.scaleBand()
    .domain(rows.map(d => d.state))
    .range([0, width])
    .padding(0.28);

  const x1 = d3.scaleBand()
    .domain(METHODS)
    .range([0, x0.bandwidth()])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(rows, d =>
      layout === "stacked" ? d.total : Math.max(d["Police issued"], d["Camera issued"])
    )])
    .nice()
    .range([height, 0]);

  /*AXES */
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x0))
    .selectAll("text")
    .style("font-size", "12px")
    .style("text-anchor", "middle");

  svg.append("g")
    .call(d3.axisLeft(y).tickFormat(d3.format("~s")));

  /* BARS*/
  const barGroups = svg.selectAll(".bar-group")
    .data(rows)
    .enter()
    .append("g")
    .attr("transform", d => `translate(${x0(d.state)},0)`);

  if (layout === "grouped") {
    /*** GROUPED MODE ***/
    barGroups.selectAll("rect")
      .data(d => METHODS.map(m => ({ method: m, value: d[m], state: d.state })))
      .enter()
      .append("rect")
      .attr("x", d => x1(d.method))
      .attr("width", x1.bandwidth())
      .attr("y", d => y(d.value))
      .attr("height", d => height - y(d.value))
      .attr("fill", d => COLORS[d.method])
      .attr("rx", 6)
      .on("mousemove", showTooltip)
      .on("mouseout", hideTooltip);

  } else {
    /*** STACKED MODE ***/
    rows.forEach(r => {
      let acc = 0;
      METHODS.forEach(m => {
        r[m + "_y0"] = acc;
        r[m + "_y1"] = acc + r[m];
        acc += r[m];
      });
    });

    barGroups.selectAll("rect")
      .data(d => METHODS.map(m => ({
        method: m,
        y0: d[m + "_y0"],
        y1: d[m + "_y1"],
        state: d.state,
        value: d[m]
      })))
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("width", x0.bandwidth())
      .attr("y", d => y(d.y1))
      .attr("height", d => y(d.y0) - y(d.y1))
      .attr("fill", d => COLORS[d.method])
      .attr("rx", 6)
      .on("mousemove", showTooltip)
      .on("mouseout", hideTooltip);
  }

  /*TOOLTIP **/
  function showTooltip(event, d) {
    q2gTooltip
      .style("opacity", 1)
      .html(`
        <strong>${d.state}</strong><br>
        ${d.method}: ${d.value.toLocaleString()}
      `)
      .style("left", (event.pageX + 12) + "px")
      .style("top",  (event.pageY - 20) + "px");
  }

  function hideTooltip() {
    q2gTooltip.style("opacity", 0);
  }
}
