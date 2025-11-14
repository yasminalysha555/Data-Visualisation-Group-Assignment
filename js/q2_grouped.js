const q2gMargin = { top: 40, right: 40, bottom: 70, left: 60 },
      q2gWidth  = 1000 - q2gMargin.left - q2gMargin.right,
      q2gHeight = 400 - q2gMargin.top - q2gMargin.bottom;

const q2gSvg = d3.select("#q2-grouped")
  .append("svg")
  .attr("width", q2gWidth + q2gMargin.left + q2gMargin.right)
  .attr("height", q2gHeight + q2gMargin.top + q2gMargin.bottom)
  .append("g")
  .attr("transform", `translate(${q2gMargin.left},${q2gMargin.top})`);

const q2gTooltip = d3.select("#tooltip");

d3.csv("data/)mobile_phone_cleaned.csv").then(data => {
  data.forEach(d => {
    d.YEAR = +d.YEAR;
    d.TOTAL_FINES = +d.TOTAL_FINES;
  });

  const methods = [...new Set(data.map(d => d.DETECTION_METHOD))];

  const yearly = d3.rollups(
    data,
    v => {
      const obj = {};
      methods.forEach(m => {
        obj[m] = d3.sum(v.filter(d => d.DETECTION_METHOD === m), d => d.TOTAL_FINES);
      });
      return obj;
    },
    d => d.YEAR
  ).map(([YEAR, vals]) => ({ YEAR, ...vals }));

  const x0 = d3.scaleBand()
    .domain(yearly.map(d => d.YEAR))
    .range([0, q2gWidth])
    .padding(0.2);

  const x1 = d3.scaleBand()
    .domain(methods)
    .range([0, x0.bandwidth()])
    .padding(0.1);

  const y = d3.scaleLinear()
    .domain([0, d3.max(yearly, d => d3.max(methods, m => d[m] || 0))]).nice()
    .range([q2gHeight, 0]);

  const color = d3.scaleOrdinal()
    .domain(methods)
    .range(["#42a5f5", "#ffb74d"]);

  q2gSvg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${q2gHeight})`)
    .call(d3.axisBottom(x0).tickFormat(d3.format("d")))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  q2gSvg.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y));

  q2gSvg.append("g")
    .selectAll("g")
    .data(yearly)
    .enter()
    .append("g")
    .attr("transform", d => `translate(${x0(d.YEAR)},0)`)
    .selectAll("rect")
    .data(d => methods.map(m => ({ key: m, value: d[m] || 0, year: d.YEAR })))
    .enter()
    .append("rect")
    .attr("x", d => x1(d.key))
    .attr("y", d => y(d.value))
    .attr("width", x1.bandwidth())
    .attr("height", d => q2gHeight - y(d.value))
    .attr("fill", d => color(d.key))
    .attr("rx", 4)
    .on("mouseover", (event, d) => {
      q2gTooltip.style("opacity", 1)
        .html(
          `<strong>${d.key}</strong><br/>Year: ${d.year}<br/>Fines: ${d.value.toLocaleString()}`
        )
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 20) + "px");
    })
    .on("mouseout", () => q2gTooltip.style("opacity", 0));
});
