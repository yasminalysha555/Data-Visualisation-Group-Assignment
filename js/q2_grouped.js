/*GROUPED BAR CHART */

const groupedTooltip = d3.select("#tooltip");

// Layout + sizing
const gMargin = { top: 60, right: 60, bottom: 100, left: 100 };
const gWidth = 1100 - gMargin.left - gMargin.right;
const gHeight = 500 - gMargin.top - gMargin.bottom;

//Colour-blind safe palette
const gColors = {
  "Police issued": "#0072B2",   // blue
  "Camera issued": "#D55E00"    // vermillion
};

const gMethods = ["Police issued", "Camera issued"];

let gRaw = [];
let gMetric = "TOTAL_FINES";
let gLayout = "grouped";
let gHiddenSeries = new Set();

// Load data
d3.csv("data/mobile_phone_cleaned.csv").then(data => {
  data.forEach(d => {
    d.YEAR = +d.YEAR;
    d.TOTAL_FINES = +d.TOTAL_FINES;
    d.FINES_PER_10K_LICENCES = +d.FINES_PER_10K_LICENCES || 0;
  });

  gRaw = data;

  setupGroupedDropdown();
  setupGroupedControls();
  createGroupedLegend();
  drawGroupedChart();
});

// Build year dropdown
function setupGroupedDropdown() {
  const select = document.getElementById("q2-year-select");
  const years = [...new Set(gRaw.map(d => d.YEAR))].sort();

  let html = `
    <option value="all" selected>All years (2008–2024)</option>
    <option value="camera-era">Camera era (2020–2024)</option>
    <option value="police-era">Police era (2008–2019)</option>
    <optgroup label="Individual Years">`;

  years.forEach(y => html += `<option value="${y}">${y}</option>`);
  html += `</optgroup>`;

  select.innerHTML = html;
}

// Setup controls
function setupGroupedControls() {
  document.querySelectorAll('input[name="q2g-metric"]').forEach(r =>
    r.addEventListener("change", e => {
      gMetric = e.target.value;
      drawGroupedChart();
    })
  );

  document.querySelectorAll('input[name="q2g-layout"]').forEach(r =>
    r.addEventListener("change", e => {
      gLayout = e.target.value;
      drawGroupedChart();
    })
  );

  document.getElementById("q2-year-select")
    .addEventListener("change", drawGroupedChart);
}

// Create interactive legend
function createGroupedLegend() {
  const legendContainer = d3.select("#grouped-legend");
  
  gMethods.forEach(method => {
    const item = legendContainer.append("div")
      .attr("class", "legend-item")
      .style("color", gColors[method])
      .on("click", () => toggleGroupedSeries(method));
    
    item.append("div")
      .attr("class", "legend-color")
      .style("background", gColors[method]);
    
    item.append("div")
      .attr("class", "legend-label")
      .text(method);
  });
}

// Toggle series visibility
function toggleGroupedSeries(method) {
  if (gHiddenSeries.has(method)) {
    gHiddenSeries.delete(method);
  } else {
    gHiddenSeries.add(method);
  }
  
  d3.select("#grouped-legend").selectAll(".legend-item")
    .classed("inactive", function() {
      const label = d3.select(this).select(".legend-label").text();
      return gHiddenSeries.has(label);
    });
  
  drawGroupedChart();
}

// Main draw function
function drawGroupedChart() {
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

  const filtered = gRaw.filter(filterFn);
  const states = [...new Set(filtered.map(d => d.JURISDICTION))].sort();

  // Filter visible methods
  const visibleMethods = gMethods.filter(m => !gHiddenSeries.has(m));

  // Aggregate by State
  const rows = states.map(state => {
    const row = { state };
    gMethods.forEach(m => {
      row[m] = d3.sum(
        filtered.filter(d =>
          d.JURISDICTION === state && d.DETECTION_METHOD === m
        ),
        d => d[gMetric]
      );
    });
    row.total = row["Police issued"] + row["Camera issued"];
    return row;
  });

  // Sort highest → lowest
  rows.sort((a, b) => b.total - a.total);

  // Clear previous
  const container = d3.select("#q2-grouped");
  container.selectAll("svg").remove();

  const svg = container.append("svg")
    .attr("width", gWidth + gMargin.left + gMargin.right)
    .attr("height", gHeight + gMargin.top + gMargin.bottom)
    .append("g")
    .attr("transform", `translate(${gMargin.left},${gMargin.top})`);

  // Scales
  const x0 = d3.scaleBand()
    .domain(rows.map(d => d.state))
    .range([0, gWidth])
    .padding(0.3);

  const x1 = d3.scaleBand()
    .domain(visibleMethods)
    .range([0, x0.bandwidth()])
    .padding(0.15);

  const y = d3.scaleLinear()
    .domain([0, d3.max(rows, d =>
      gLayout === "stacked" ? d.total : Math.max(d["Police issued"], d["Camera issued"])
    )])
    .nice()
    .range([gHeight, 0]);

  // Add grid
  svg.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y)
    .tickSize(-(gWidth - 40))   
    .tickFormat(""))
    .style("opacity", 0.1);

  // X-axis with proper styling to prevent overflow
  const xAxis = svg.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${gHeight})`)
    .call(d3.axisBottom(x0).tickSize(0));

  xAxis.selectAll("text")
    .style("font-size", "11px")
    .style("font-weight", "600")
    .style("text-anchor", "end")
    .attr("transform", "rotate(-45)")
    .attr("dx", "-0.8em")
    .attr("dy", "0.3em");

  // Remove the x-axis line to prevent overflow
  xAxis.select(".domain").remove();

  // Y-axis with cleaner styling
  const yAxis = svg.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(y).tickFormat(d3.format("~s")).tickSize(-gWidth));

  yAxis.selectAll("text")
    .style("font-size", "12px")
    .style("font-weight", "500");

  yAxis.select(".domain").remove();
  yAxis.selectAll(".tick line")
    .style("stroke", "#e2e8f0")
    .style("stroke-dasharray", "2,2");

  // X-axis label positioned well below the rotated labels
  svg.append("text")
    .attr("class", "axis-label")
    .attr("x", gWidth / 2)
    .attr("y", gHeight + 75)
    .attr("text-anchor", "middle")
    .style("font-size", "13px")
    .style("font-weight", "600")
    .text("State/Territory");

  svg.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -gHeight / 2)
    .attr("y", -70)
    .attr("text-anchor", "middle")
    .style("font-size", "13px")
    .style("font-weight", "600")
    .text(gMetric === "TOTAL_FINES" ? "Total Fines" : "Fines per 10k Licences");

  // Draw bars
  const barGroups = svg.selectAll(".bar-group")
    .data(rows)
    .enter()
    .append("g")
    .attr("transform", d => `translate(${x0(d.state)},0)`);

  if (gLayout === "grouped") {
    /*** GROUPED MODE ***/
    barGroups.selectAll("rect")
      .data(d => visibleMethods.map(m => ({ method: m, value: d[m], state: d.state })))
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", d => x1(d.method))
      .attr("width", x1.bandwidth())
      .attr("y", gHeight)
      .attr("height", 0)
      .attr("fill", d => gColors[d.method])
      .attr("rx", 6)
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        d3.select(this)
          .style("opacity", 0.8)
          .style("filter", "brightness(1.1)");
        showGroupedTooltip(event, d);
      })
      .on("mouseout", function(event, d) {
        d3.select(this)
          .style("opacity", 1)
          .style("filter", "none");
        hideGroupedTooltip();
      })
      .transition()
      .duration(800)
      .ease(d3.easeCubicOut)
      .attr("y", d => y(d.value))
      .attr("height", d => gHeight - y(d.value));

  } else {
    /*** STACKED MODE ***/
    rows.forEach(r => {
      let acc = 0;
      gMethods.forEach(m => {
        r[m + "_y0"] = acc;
        r[m + "_y1"] = acc + r[m];
        acc += r[m];
      });
    });

    barGroups.selectAll("rect")
      .data(d => visibleMethods.map(m => ({
        method: m,
        y0: d[m + "_y0"],
        y1: d[m + "_y1"],
        state: d.state,
        value: d[m]
      })))
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", 0)
      .attr("width", x0.bandwidth())
      .attr("y", gHeight)
      .attr("height", 0)
      .attr("fill", d => gColors[d.method])
      .attr("rx", 6)
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        d3.select(this)
          .style("opacity", 0.8)
          .style("filter", "brightness(1.1)");
        showGroupedTooltip(event, d);
      })
      .on("mouseout", function(event, d) {
        d3.select(this)
          .style("opacity", 1)
          .style("filter", "none");
        hideGroupedTooltip();
      })
      .transition()
      .duration(800)
      .ease(d3.easeCubicOut)
      .attr("y", d => y(d.y1))
      .attr("height", d => y(d.y0) - y(d.y1));
  }
}

// Tooltip functions
function showGroupedTooltip(event, d) {
  const formatValue = gMetric === "TOTAL_FINES" 
    ? d.value.toLocaleString() 
    : d.value.toFixed(1);

  const html = `
    <strong>${d.state}</strong>
    <div class="tooltip-row">
      <span class="tooltip-label">
        <span class="tooltip-color" style="background: ${gColors[d.method]}"></span>
        ${d.method}
      </span>
      <span class="tooltip-value">${formatValue}</span>
    </div>
  `;

  groupedTooltip
    .style("opacity", 1)
    .html(html)
    .style("left", (event.pageX + 12) + "px")
    .style("top", (event.pageY - 20) + "px");
}

function hideGroupedTooltip() {
  groupedTooltip.style("opacity", 0);
}

// Export functionality
document.getElementById("export-grouped").addEventListener("click", () => {
  const svg = document.querySelector("#q2-grouped svg");
  if (!svg) return;
  
  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const img = new Image();
  
  canvas.width = svg.width.baseVal.value;
  canvas.height = svg.height.baseVal.value;
  
  img.onload = () => {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "grouped-bar-chart.png";
      a.click();
      URL.revokeObjectURL(url);
    });
  };
  
  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
});