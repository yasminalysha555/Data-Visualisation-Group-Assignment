const q1SmallTooltip = d3.select("#tooltip");

d3.csv("data/mobile_phone_cleaned.csv").then(raw => {

  raw.forEach(d => {
    d.YEAR = +d.YEAR;
    d.TOTAL_FINES = +d.TOTAL_FINES || 0;
    d.LICENCE_TOTAL = +d.LICENCE_TOTAL || 0;
  });

  const aggregated = Array.from(
    d3.rollup(
      raw,
      v => {
        const totalFines = d3.sum(v, d => d.TOTAL_FINES);
        const totalLic = d3.sum(v, d => d.LICENCE_TOTAL);
        const per10k = totalLic ? (totalFines / totalLic) * 10000 : 0;

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

  const states = [...new Set(aggregated.map(d => d.JURISDICTION))];

  const width = 320;
  const height = 220;

  const margin = { top: 25, right: 35, bottom: 40, left: 55 };

  const container = d3.select("#q1-small");

  /* COLOR SCALE (unchanged) */
  const color = d3.scaleOrdinal()
    .domain(states)
    .range([
      "#4e79a7", "#f28e2b", "#e15759", "#76b7b2",
      "#59a14f", "#edc948", "#b07aa1", "#ff9da7"
    ]);

  states.forEach(state => {

    let stateData = aggregated.filter(d => d.JURISDICTION === state);
    stateData = stateData.sort((a, b) => a.YEAR - b.YEAR);

    const maxVal = d3.max(stateData, d => d.TOTAL_FINES) || 1;

    const x = d3.scaleLinear()
      .domain(d3.extent(stateData, d => d.YEAR))
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, maxVal])
      .nice()
      .range([height - margin.bottom, margin.top]);

    /* 🔥 SVG FIX: override CSS and force custom width/height */
    const svg = container.append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("data-state", state)
      .style("width", width + "px")   // override CSS
      .style("height", height + "px") // override CSS
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

    /* X-AXIS */
    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(
        d3.axisBottom(x)
          .ticks(5)
          .tickFormat(d3.format("d"))
      )
      .selectAll("text")
      .style("font-size", "12px")
      .style("dy", "1.3em");

    /* Y-AXIS */
    svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(
        d3.axisLeft(y)
          .ticks(5)
          .tickFormat(d => d.toLocaleString())
      )
      .selectAll("text")
      .style("font-size", "12px");

    /* LINE */
    const line = d3.line()
      .curve(d3.curveMonotoneX)
      .x(d => x(d.YEAR))
      .y(d => y(d.TOTAL_FINES));

    const path = svg.append("path")
      .datum(stateData)
      .attr("fill", "none")
      .attr("stroke", color(state))
      .attr("stroke-width", 2)
      .attr("d", line);

    const len = path.node().getTotalLength();
    path.attr("stroke-dasharray", `${len} ${len}`)
      .attr("stroke-dashoffset", len)
      .transition()
      .duration(800)
      .ease(d3.easeCubic)
      .attr("stroke-dashoffset", 0);

    /* DOTS + TOOLTIP */
    svg.selectAll(".dot")
      .data(stateData)
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("cx", d => x(d.YEAR))
      .attr("cy", d => y(d.TOTAL_FINES))
      .attr("r", 3.5)
      .attr("fill", color(state))
      .on("mouseover", (event, d) => {
        const prev = stateData.find(p => p.YEAR === d.YEAR - 1);
        const pct = prev ? (((d.TOTAL_FINES - prev.TOTAL_FINES) / prev.TOTAL_FINES) * 100).toFixed(1) : "—";

        q1SmallTooltip
          .style("opacity", 1)
          .html(`
            <strong>${state}</strong><br/>
            Year: ${d.YEAR}<br/>
            Fines: <strong>${d.TOTAL_FINES.toLocaleString()}</strong><br/>
            Change: <strong>${pct === "—" ? "—" : (pct > 0 ? "+" : "") + pct + "%"}</strong>
          `)
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => q1SmallTooltip.style("opacity", 0));

    /* STATE LABEL */
    svg.append("text")
      .attr("x", margin.left)
      .attr("y", margin.top - 12)
      .attr("fill", "#003366")
      .attr("font-size", "14px")
      .attr("font-weight", "700")
      .text(state);
  });
});
