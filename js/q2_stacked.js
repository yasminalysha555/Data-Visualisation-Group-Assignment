const q2Tooltip = d3.select("#tooltip");

const q2StackMargin = { top: 40, right: 170, bottom: 45, left: 65 },
      q2StackWidth  = 1000 - q2StackMargin.left - q2StackMargin.right,
      q2StackHeight = 420  - q2StackMargin.top  - q2StackMargin.bottom;

const q2StackSvg = d3.select("#q2-stacked")
  .append("svg")
  .attr("width",  q2StackWidth  + q2StackMargin.left + q2StackMargin.right)
  .attr("height", q2StackHeight + q2StackMargin.top  + q2StackMargin.bottom)
  .append("g")
  .attr("transform", `translate(${q2StackMargin.left},${q2StackMargin.top})`);

const q2StackMethods = ["Police issued", "Camera issued"];
const q2StackColor   = d3.scaleOrdinal()
  .domain(q2StackMethods)
  .range(["#0072B2", "#E69F00"]);

let q2StackRaw = [];
let q2StackX, q2StackY;

let q2StackMetric   = "TOTAL_FINES";  // TOTAL_FINES or FINES_PER_10K_LICENCES
let q2StackViewMode = "absolute";     // absolute or percent
let q2LegendFocus   = null;           // null = both, otherwise "Police issued" or "Camera issued"

// Load data
d3.csv("data/mobile_phone_cleaned.csv").then(data => {
  data.forEach(d => {
    d.YEAR                    = +d.YEAR;
    d.TOTAL_FINES             = +d.TOTAL_FINES;
    d.FINES_PER_10K_LICENCES  = +d.FINES_PER_10K_LICENCES || 0;
  });

  q2StackRaw = data;

  setupStackedScales();
  drawStackedChart();
  setupStackedControls();
});

/*SCALES + AXES*/

function setupStackedScales() {
  const years = d3.extent(q2StackRaw, d => d.YEAR);

  q2StackX = d3.scaleLinear()
    .domain(years)
    .range([0, q2StackWidth]);

  q2StackY = d3.scaleLinear()
    .range([q2StackHeight, 0]);

  // Axes groups
  q2StackSvg.append("g")
    .attr("class", "axis x-axis")
    .attr("transform", `translate(0,${q2StackHeight})`);

  q2StackSvg.append("g")
    .attr("class", "axis y-axis");

  // Hover guideline
  q2StackSvg.append("line")
    .attr("class", "hover-line")
    .attr("y1", 0)
    .attr("y2", q2StackHeight)
    .attr("stroke", "#555")
    .attr("stroke-width", 1.2)
    .style("opacity", 0);
}

/*MAIN DRAW FUNCTION */

function drawStackedChart() {
  // Clear previous layers/overlays (but keep axes & hover line)
  q2StackSvg.selectAll(".stack-layer").remove();
  q2StackSvg.selectAll(".hover-overlay").remove();
  q2StackSvg.selectAll(".q2-stack-legend").remove();

  // Aggregate national totals by year & method
  const years = [...new Set(q2StackRaw.map(d => d.YEAR))].sort((a,b) => a - b);

  const yearly = years.map(year => {
    const row = { YEAR: year };
    q2StackMethods.forEach(m => {
      const subset = q2StackRaw.filter(d => d.YEAR === year && d.DETECTION_METHOD === m);
      row[m] = d3.sum(subset, d => d[q2StackMetric]);
    });
    return row;
  });

  
  const activeMethods = q2LegendFocus ? [q2LegendFocus] : q2StackMethods;

  
  if (q2StackViewMode === "percent") {
    q2StackY.domain([0, 100]).nice();
  } else {
    const maxY = d3.max(yearly, yr =>
      activeMethods.reduce((sum, m) => sum + (yr[m] || 0), 0)
    ) || 1;
    q2StackY.domain([0, maxY]).nice();
  }

  // Update axes
  q2StackSvg.select(".x-axis")
    .transition().duration(600)
    .call(d3.axisBottom(q2StackX).tickFormat(d3.format("d")));

  q2StackSvg.select(".y-axis")
    .transition().duration(600)
    .call(d3.axisLeft(q2StackY));

  // Prepare stack data (absolute or percent)
  const stackInput = yearly.map(yr => {
    const total = d3.sum(q2StackMethods.map(m => yr[m] || 0));
    const obj = { YEAR: yr.YEAR };
    q2StackMethods.forEach(m => {
      if (q2StackViewMode === "percent") {
        obj[m] = total ? (yr[m] / total) * 100 : 0;
      } else {
        obj[m] = yr[m];
      }
    });
    return obj;
  });

  const stack = d3.stack()
    .keys(activeMethods)(stackInput);

  const area = d3.area()
    .curve(d3.curveMonotoneX)
    .x(d => q2StackX(d.data.YEAR))
    .y0(d => q2StackY(d[0]))
    .y1(d => q2StackY(d[1]));

  // Draw layers
  const layers = q2StackSvg.selectAll(".stack-layer")
    .data(stack, d => d.key);

  layers.enter()
    .append("path")
    .attr("class", "stack-layer")
    .attr("fill", d => q2StackColor(d.key))
    .attr("opacity", 0.9)
    .attr("d", area)
    .style("filter", "drop-shadow(0 2px 6px rgba(0,0,0,0.12))")
    .style("cursor", "pointer")
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 0.5)
    .merge(layers)
    .transition()
    .duration(700)
    .attr("d", area);

  layers.exit()
    .transition().duration(400)
    .attr("opacity", 0)
    .remove();

  // Hover overlay for guideline + tooltip
  const hoverLine = q2StackSvg.select(".hover-line");

  q2StackSvg.append("rect")
    .attr("class", "hover-overlay")
    .attr("fill", "transparent")
    .attr("width", q2StackWidth)
    .attr("height", q2StackHeight)
    .on("mousemove", (event) => {
      const [mx] = d3.pointer(event);
      const year = Math.round(q2StackX.invert(mx));
      const yrRow = yearly.find(r => r.YEAR === year);
      if (!yrRow) return;

      const total = d3.sum(q2StackMethods.map(m => yrRow[m] || 0));

      hoverLine
        .attr("x1", q2StackX(year))
        .attr("x2", q2StackX(year))
        .style("opacity", 1);

      q2Tooltip
        .style("opacity", 1)
        .html(`
          <div style="
            background:#fff;
            padding:10px 12px;
            border-radius:10px;
            border:1px solid #d0e2ff;
            box-shadow:0 4px 14px rgba(0,0,0,0.12);
            max-width:260px;
          ">
            <div style="font-weight:700;font-size:15px;color:#003366;margin-bottom:6px;">
              ${year}
            </div>

            ${q2StackMethods.map(m => {
              const v = yrRow[m] || 0;
              const share = total ? (v / total * 100).toFixed(1) : 0;
              return `
                <div style="margin-bottom:6px;border-left:4px solid ${q2StackColor(m)};padding-left:6px;">
                  <strong style="color:${q2StackColor(m)}">${m}</strong><br>
                  ${q2StackMetric === "TOTAL_FINES"
                    ? `Fines: ${v.toLocaleString()}`
                    : `Rate: ${v.toFixed(1)} per 10k`}
                  <br>
                  Share: ${share}%
                </div>
              `;
            }).join("")}
          </div>
        `)
        .style("left", (event.pageX + 14) + "px")
        .style("top",  (event.pageY - 20) + "px");
    })
    .on("mouseout", () => {
      hoverLine.style("opacity", 0);
      q2Tooltip.style("opacity", 0);
    });

  // Legend with focus behaviour
  const legend = q2StackSvg.append("g")
    .attr("class", "q2-stack-legend")
    .attr("transform", `translate(${q2StackWidth + 20}, 0)`);

  legend.selectAll(".legend-row")
    .data(q2StackMethods)
    .enter()
    .append("g")
    .attr("class", "legend-row")
    .attr("transform", (d,i) => `translate(0, ${i * 26})`)
    .style("cursor", "pointer")
    .each(function(method) {
      const row = d3.select(this);

      row.append("rect")
        .attr("width", 14)
        .attr("height", 14)
        .attr("rx", 3)
        .attr("ry", 3)
        .attr("fill", q2StackColor(method))
        .attr("stroke", "#002b4c")
        .attr("stroke-width", 0.6)
        .style("opacity", q2LegendFocus && q2LegendFocus !== method ? 0.25 : 1);

      row.append("text")
        .attr("x", 20)
        .attr("y", 11)
        .text(method)
        .attr("fill", "#003366")
        .style("font-size", "13px");

      row.on("click", () => {
        // Toggle focus: if clicking current focus → reset to both; else focus that series
        if (q2LegendFocus === method) {
          q2LegendFocus = null;
        } else {
          q2LegendFocus = method;
        }
        drawStackedChart();
      });
    });
}

/* CONTROLS  */

function setupStackedControls() {
  document.querySelectorAll('input[name="q2-metric"]').forEach(r => {
    r.addEventListener("change", e => {
      q2StackMetric = e.target.value;
      drawStackedChart();
    });
  });

  document.querySelectorAll('input[name="q2-view"]').forEach(r => {
    r.addEventListener("change", e => {
      q2StackViewMode = e.target.value;
      drawStackedChart();
    });
  });
}
