(function(){
  const file = 'data/(FINALISED)mobile_phone_cleaned.csv';
  const jurisdictions = ['NSW','QLD','VIC','TAS','ACT'];
  const svg = d3.select('#multiLineChart');
  const container = document.getElementById('chart-container');
  if(!svg.node()) return;
  const margin = {top: 30, right: 140, bottom: 50, left: 70};
  const width = Math.min(900, container.clientWidth || 900) - margin.left - margin.right;
  const height = 420 - margin.top - margin.bottom;

  svg.attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
     .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  d3.csv(file).then(raw => {
    raw.forEach(d => {
      d.YEAR = +d.YEAR;
      d.TOTAL_FINES = +d.TOTAL_FINES || 0;
    });

    const years = Array.from(new Set(raw.map(d=>d.YEAR))).sort((a,b)=>a-b);

    const series = jurisdictions.map(state => {
      const byYear = new Map(years.map(y => [y, 0]));
      raw.filter(d => d.JURISDICTION === state).forEach(d => {
        byYear.set(d.YEAR, (byYear.get(d.YEAR) || 0) + d.TOTAL_FINES);
      });
      return { id: state, values: years.map(y => ({ year: y, value: byYear.get(y) || 0 })) };
    });

    const x = d3.scaleLinear().domain(d3.extent(years)).range([0, width]);
    const y = d3.scaleLinear().domain([0, d3.max(series, s => d3.max(s.values, v => v.value))]).nice().range([height, 0]);

    const color = d3.scaleOrdinal().domain(jurisdictions)
      .range(['#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd']);

    const xAxis = d3.axisBottom(x).ticks(Math.min(years.length, 12)).tickFormat(d3.format('d'));
    const yAxis = d3.axisLeft(y).ticks(6).tickFormat(d => d3.format(',')(d));

    g.append('g').attr('transform', `translate(0,${height})`).call(xAxis);
    g.append('g').call(yAxis);

    g.append('text')
      .attr('x', width/2)
      .attr('y', height + margin.bottom - 6)
      .attr('text-anchor', 'middle')
      .attr('fill', '#003366')
      .text('Year');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height/2)
      .attr('y', -margin.left + 18)
      .attr('text-anchor', 'middle')
      .attr('fill', '#003366')
      .text('Total Offences (fines)');

    const line = d3.line().x(d => x(d.year)).y(d => y(d.value)).curve(d3.curveMonotoneX);

    const lines = g.selectAll('.line-group').data(series).enter().append('g').attr('class','line-group');

    lines.append('path')
      .attr('class', 'line')
      .attr('d', d => line(d.values))
      .style('fill', 'none')
      .style('stroke', d => color(d.id))
      .style('stroke-width', 2.5);

    // points + tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class','chart-tooltip')
      .style('position','absolute')
      .style('pointer-events','none')
      .style('background','#fff')
      .style('border','1px solid #ccc')
      .style('padding','6px 8px')
      .style('border-radius','4px')
      .style('display','none')
      .style('font-size','13px');

    lines.selectAll('circle')
      .data(d => d.values.map(v => ({state: d.id, year: v.year, value: v.value})))
      .enter().append('circle')
        .attr('cx', d => x(d.year))
        .attr('cy', d => y(d.value))
        .attr('r', 3.2)
        .attr('fill', d => color(d.state))
        .on('mouseover', (event, d) => {
          tooltip.style('display','block')
                 .html(`<strong>${d.state}</strong><br/>${d.year}: ${d3.format(',')(d.value)}`);
        })
        .on('mousemove', (event) => {
          tooltip.style('left', (event.pageX + 10) + 'px').style('top', (event.pageY + 10) + 'px');
        })
        .on('mouseout', () => tooltip.style('display','none'));

    // legend
    const legend = svg.append('g')
      .attr('transform', `translate(${width + margin.left + 10}, ${margin.top})`);

    const legendItem = legend.selectAll('.legend-item')
      .data(series)
      .enter().append('g')
      .attr('class','legend-item')
      .attr('transform', (d,i) => `translate(0, ${i*22})`);

    legendItem.append('rect')
      .attr('width', 14).attr('height', 12)
      .attr('fill', d => color(d.id));

    legendItem.append('text')
      .attr('x', 20).attr('y', 10)
      .attr('fill', '#003366')
      .attr('font-size', 13)
      .text(d => d.id);

  }).catch(err => {
    console.error('Error loading CSV for multi-line chart:', err);
  });
})();
