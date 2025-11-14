const q1Margin = { top: 40, right: 150, bottom: 40, left: 60 },
      q1Width  = 1000 - q1Margin.left - q1Margin.right,
      q1Height = 400 - q1Margin.top - q1Margin.bottom;

const q1Svg = d3.select("#q1-multiline")
  .append("svg")
  .attr("width", q1Width + q1Margin.left + q1Margin.right)
  .attr("height", q1Height + q1Margin.top + q1Margin.bottom)
  .append("g")
  .attr("transform", `translate(${q1Margin.left},${q1Margin.top})`);

const q1Tooltip = d3.select("#tooltip");

d3.csv("data/mobile_phone_cleaned.csv").then(data => {
  data.forEach(d => {
    d.YEAR = +d.YEAR;
    d.TOTAL_FINES = +d.TOTAL_FINES;
  });

  const jurisdictions = [...new Set(data.map(d => d.JURISDICTION))];

  const x = d3.scaleLinear()
    .domain(d3.extent(data, d => d.YEAR))
    .range([0, q1Width]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.TOTAL_FINES)]).nice()
    .range([q1Height, 0]);

  const color = d3.scaleOrdinal()
    .domain(jurisdictions)
    .range(d3.schemeTableau10);

  q1Svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${q1Height})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  q1Svg.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y));

  const line = d3.line()
    .curve(d3.curveMonotoneX)
    .x(d => x(d.YEAR))
    .y(d => y(d.TOTAL_FINES));

  const lineGroups = {};
  const stateStatus = {};
  jurisdictions.forEach(j => stateStatus[j] = true);

  jurisdictions.forEach(j => {
    const filtered = data.filter(d => d.JURISDICTION === j);

    const path = q1Svg.append("path")
      .datum(filtered)
      .attr("class", "line-series")
      .attr("fill", "none")
      .attr("stroke", color(j))
      .attr("stroke-width", 2)
      .attr("d", line);

    const dots = q1Svg.selectAll(`.dot-${j}`)
      .data(filtered)
      .enter()
      .append("circle")
      .attr("class", `dot-${j}`)
      .attr("cx", d => x(d.YEAR))
      .attr("cy", d => y(d.TOTAL_FINES))
      .attr("r", 3)
      .attr("fill", color(j))
      .on("mouseover", (event, d) => {
        q1Tooltip.style("opacity", 1)
          .html(
            `<strong>${d.JURISDICTION}</strong><br/>Year: ${d.YEAR}<br/>Fines: ${d.TOTAL_FINES.toLocaleString()}`
          )
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 20) + "px");
      })
      .on("mouseout", () => q1Tooltip.style("opacity", 0));

    lineGroups[j] = { path, dots };
  });

  const legend = q1Svg.append("g")
    .attr("transform", `translate(${q1Width + 20}, 0)`);

  const legendItems = legend.selectAll(".legend-item")
    .data(jurisdictions)
    .enter()
    .append("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(0, ${i * 20})`)
    .on("click", (event, d) => {
      stateStatus[d] = !stateStatus[d];
      const active = stateStatus[d];
      lineGroups[d].path.classed("inactive", !active);
      lineGroups[d].dots.classed("inactive", !active);
    });

  legendItems.append("rect")
    .attr("x", 0)
    .attr("y", -8)
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", d => color(d));

  legendItems.append("text")
    .attr("x", 18)
    .attr("y", 0)
    .attr("dy", "0.35em")
    .text(d => d);
});

