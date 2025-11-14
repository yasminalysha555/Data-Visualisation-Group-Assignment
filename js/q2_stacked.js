const q2Margin = { top: 40, right: 150, bottom: 40, left: 60 },
      q2Width  = 1000 - q2Margin.left - q2Margin.right,
      q2Height = 400 - q2Margin.top - q2Margin.bottom;

const q2Svg = d3.select("#q2-stacked")
  .append("svg")
  .attr("width", q2Width + q2Margin.left + q2Margin.right)
  .attr("height", q2Height + q2Margin.top + q2Margin.bottom)
  .append("g")
  .attr("transform", `translate(${q2Margin.left},${q2Margin.top})`);

const q2Tooltip = d3.select("#tooltip");

let q2RawData, q2Methods, q2X, q2Y, q2Color;
let currentMetric = "TOTAL_FINES";

d3.csv("data/mobile_phone_cleaned.csv").then(data => {
  data.forEach(d => {
    d.YEAR = +d.YEAR;
    d.TOTAL_FINES = +d.TOTAL_FINES;
    d.FINES_PER_10K_LICENCES = +d.FINES_PER_10K_LICENCES || 0;
  });

  q2RawData = data;
  q2Methods = [...new Set(data.map(d => d.DETECTION_METHOD))];

  q2Color = d3.scaleOrdinal()
    .domain(q2Methods)
    .range(["#42a5f5", "#ffb74d"]);

  q2X = d3.scaleLinear()
    .domain(d3.extent(data, d => d.YEAR))
    .range([0, q2Width]);

  q2Svg.append("g")
    .attr("class", "axis x-axis")
    .attr("transform", `translate(0,${q2Height})`)
    .call(d3.axisBottom(q2X).tickFormat(d3.format("d")));

  q2Svg.append("g")
    .attr("class", "axis y-axis");

  const legend = q2Svg.append("g")
    .attr("transform", `translate(${q2Width + 20}, 0)`);

  const methodStatus = {};
  q2Methods.forEach(m => methodStatus[m] = true);

  const legendItems = legend.selectAll(".legend-item")
    .data(q2Methods)
    .enter()
    .append("g")
    .attr("class", "legend-item")
    .attr("transform", (d,i) => `translate(0, ${i * 20})`)
    .on("click", (event, d) => {
      methodStatus[d] = !methodStatus[d];
      updateQ2(currentMetric, methodStatus);
    });

  legendItems.append("rect")
    .attr("x", 0)
    .attr("y", -8)
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", d => q2Color(d));

  legendItems.append("text")
    .attr("x", 18)
    .attr("y", 0)
    .attr("dy", "0.35em")
    .text(d => d);

  document.querySelectorAll('input[name="metric"]').forEach(radio => {
    radio.addEventListener("change", e => {
      currentMetric = e.target.value;
      updateQ2(currentMetric, methodStatus);
    });
  });

  updateQ2(currentMetric, methodStatus);
});

function updateQ2(metric, methodStatus) {
  const years = [...new Set(q2RawData.map(d => d.YEAR))].sort((a,b) => a-b);

  const yearly = years.map(year => {
    const row = { YEAR: year };
    q2Methods.forEach(m => {
      const subset = q2RawData.filter(d => d.YEAR === year && d.DETECTION_METHOD === m);
      row[m] = d3.sum(subset, d => d[metric]);
    });
    return row;
  });

  const activeMethods = q2Methods.filter(m => methodStatus[m]);

  const maxY = d3.max(yearly, d =>
    activeMethods.reduce((sum, m) => sum + (d[m] || 0), 0)
  ) || 1;

  q2Y = d3.scaleLinear()
    .domain([0, maxY]).nice()
    .range([q2Height, 0]);

  q2Svg.select(".y-axis")
    .transition()
    .duration(500)
    .call(d3.axisLeft(q2Y));

  const stack = d3.stack()
    .keys(activeMethods)(yearly);

  const area = d3.area()
    .curve(d3.curveMonotoneX)
    .x(d => q2X(d.data.YEAR))
    .y0(d => q2Y(d[0]))
    .y1(d => q2Y(d[1]));

  const layers = q2Svg.selectAll(".area-layer")
    .data(stack, d => d.key);

  layers.enter()
    .append("path")
    .attr("class", "area-layer")
    .attr("fill", d => q2Color(d.key))
    .attr("opacity", 0.85)
    .merge(layers)
    .transition()
    .duration(600)
    .attr("d", area);

  layers.exit().remove();

  q2Svg.selectAll(".area-layer")
    .on("mousemove", (event, d) => {
      const [mx] = d3.pointer(event);
      const year = Math.round(q2X.invert(mx));
      const row = yearly.find(r => r.YEAR === year);
      if (!row) return;

      q2Tooltip.style("opacity", 1)
        .html(`
          <strong>Year: ${year}</strong><br/>
          ${activeMethods.map(m =>
            `${m}: ${(row[m] || 0).toLocaleString(undefined, {maximumFractionDigits:1})}`
          ).join("<br/>")}
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 20) + "px");
    })
    .on("mouseout", () => q2Tooltip.style("opacity", 0));
}
