const q1SmallTooltip = d3.select("#tooltip");
d3.csv("data/mobile_phone_cleaned.csv").then(rawData => {

  const data = rawData.map(d => ({
    YEAR: +d.YEAR,
    JURISDICTION: d.JURISDICTION,
    DETECTION_METHOD: d.DETECTION_METHOD,
    TOTAL_FINES: +d.TOTAL_FINES
  }));

  const states = [...new Set(data.map(d => d.JURISDICTION))];

  const width = 230,
        height = 160;

  const margin = { top: 25, right: 10, bottom: 22, left: 45 };

  const container = d3.select("#q1-small");

  const color = d3.scaleOrdinal()
    .domain(states)
    .range([
      "#77AADD","#99DDFF","#DDAACC","#CCEEFF",
      "#FFAABB","#88CCEE","#EE8866","#DDCC77"
    ]);

  states.forEach(state => {

    let stateData = data.filter(d => d.JURISDICTION === state);

    stateData = stateData.sort((a, b) => a.YEAR - b.YEAR);

    const maxVal = d3.max(stateData, d => d.TOTAL_FINES) || 1;

    const x = d3.scaleLinear()
      .domain(d3.extent(stateData, d => d.YEAR))
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, maxVal])
      .nice()
      .range([height - margin.bottom, margin.top]);

    // Flexible tick count based on data scale (fixes ACT)
    let yTicks = 4;
    if (maxVal < 5000) yTicks = 3;
    if (maxVal > 20000) yTicks = 5;

    const svg = container.append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("data-state", state)
      .on("click", function () {
        const all = d3.selectAll("#q1-small svg");
        const selected = d3.select(this).classed("selected");

        if (selected) {
          all.classed("inactive", false).classed("selected", false);
        } else {
          all.classed("inactive", true).classed("selected", false);
          d3.select(this).classed("inactive", false).classed("selected", true);
        }
      });

    // X AXIS
    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(
        d3.axisBottom(x)
          .ticks(4)
          .tickFormat(d3.format("d"))
      )
      .selectAll("text")
      .style("font-size", "10px");

    // Y AXIS (FIXED)
    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(
        d3.axisLeft(y)
          .ticks(yTicks)
          .tickFormat(d => d.toLocaleString())
      )
      .selectAll("text")
      .style("font-size", "10px");

    // LINE GENERATOR
    const line = d3.line()
      .curve(d3.curveMonotoneX)
      .x(d => x(d.YEAR))
      .y(d => y(d.TOTAL_FINES));

    // ANIMATED PATH
    const path = svg.append("path")
      .datum(stateData)
      .attr("fill", "none")
      .attr("stroke", color(state))
      .attr("stroke-width", 2)
      .attr("d", line);

    const totalLength = path.node().getTotalLength();

    path
      .attr("stroke-dasharray", totalLength + " " + totalLength)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(700)
      .ease(d3.easeCubic)
      .attr("stroke-dashoffset", 0);

    // DOTS
    svg.selectAll(".dot")
      .data(stateData)
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("cx", d => x(d.YEAR))
      .attr("cy", d => y(d.TOTAL_FINES))
      .attr("r", 3)
      .attr("fill", color(state))
      .on("mouseover", (event, d) => {
        const prev = stateData.find(p => p.YEAR === d.YEAR - 1);
        const pct = prev
          ? (((d.TOTAL_FINES - prev.TOTAL_FINES) / prev.TOTAL_FINES) * 100).toFixed(1)
          : "—";

        q1SmallTooltip
          .style("opacity", 1)
          .html(`
            <strong>${state}</strong><br/>
            Year: ${d.YEAR}<br/>
            Fines: ${d.TOTAL_FINES.toLocaleString()}<br/>
            Change: ${pct === "—" ? "—" : (pct > 0 ? "+" : "") + pct + "%"}
          `)
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => q1SmallTooltip.style("opacity", 0));

    // STATE TITLE LABEL
    svg.append("text")
      .attr("x", margin.left)
      .attr("y", margin.top - 10)
      .attr("fill", "#003366")
      .attr("font-size", 12)
      .attr("font-weight", "600")
      .text(state);
  });
});
