const q1SmallTooltip = d3.select("#tooltip");

d3.csv("data/mobile_phone_cleaned.csv").then(data => {
  data.forEach(d => {
    d.YEAR = +d.YEAR;
    d.TOTAL_FINES = +d.TOTAL_FINES;
  });

  const states = [...new Set(data.map(d => d.JURISDICTION))];

  const width = 240, height = 160;
  const margin = { top: 24, right: 10, bottom: 20, left: 32 };

  const x = d3.scaleLinear()
    .domain(d3.extent(data, d => d.YEAR))
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.TOTAL_FINES)]).nice()
    .range([height - margin.bottom, margin.top]);

  const line = d3.line()
    .curve(d3.curveMonotoneX)
    .x(d => x(d.YEAR))
    .y(d => y(d.TOTAL_FINES));

  const container = d3.select("#q1-small");

  states.forEach(state => {
    const subset = data.filter(d => d.JURISDICTION === state);

    const svg = container.append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("data-state", state)   // store state name for styling
      .on("click", function () {
        const panel = d3.select(this);
        const allPanels = d3.selectAll("#q1-small svg");
        const isSelected = panel.classed("selected");

        if (isSelected) {
          // unselect → reset all
          allPanels.classed("inactive", false).classed("selected", false);
        } else {
          // select this one, fade others
          allPanels.classed("inactive", true).classed("selected", false);
          panel.classed("inactive", false).classed("selected", true);
        }
      });

    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(4).tickFormat(d3.format("d")));

    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(3));

    svg.append("path")
      .datum(subset)
      .attr("fill", "none")
      .attr("stroke", "#007acc")
      .attr("stroke-width", 2)
      .attr("d", line);

    svg.selectAll(".dot")
      .data(subset)
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("cx", d => x(d.YEAR))
      .attr("cy", d => y(d.TOTAL_FINES))
      .attr("r", 3)
      .attr("fill", "#007acc")
      .on("mouseover", (event, d) => {
        q1SmallTooltip.style("opacity", 1)
          .html(
            `<strong>${state}</strong><br/>Year: ${d.YEAR}<br/>Fines: ${d.TOTAL_FINES.toLocaleString()}`
          )
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 20) + "px");
      })
      .on("mouseout", () => q1SmallTooltip.style("opacity", 0));

    svg.append("text")
      .attr("x", margin.left)
      .attr("y", margin.top - 8)
      .attr("fill", "#003366")
      .attr("font-size", 12)
      .text(state);
  });
});
