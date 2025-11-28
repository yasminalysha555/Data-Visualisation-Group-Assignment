// q5.js — Multi-line chart: years vs total offences per jurisdiction
(function(){
  const CSV = 'data/mobile_phone_cleaned.csv';
  const svg = d3.select('#q5-svg');
  const rawW = +svg.attr('width');
  const rawH = +svg.attr('height');
  const margin = {top: 30, right: 120, bottom: 50, left: 70};
  const width = rawW - margin.left - margin.right;
  const height = rawH - margin.top - margin.bottom;

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().range([0, width]);
  const y = d3.scaleLinear().range([height, 0]);
  const color = d3.scaleOrdinal(d3.schemeTableau10);

  const xAxisG = g.append('g').attr('class','x-axis').attr('transform', `translate(0,${height})`);
  const yAxisG = g.append('g').attr('class','y-axis');

  g.append('text')
    .attr('class', 'axis-label')
    .attr('x', width / 2)
    .attr('y', height + 40)
    .attr('text-anchor', 'middle')
    .style('font-size', '14px')
    .style('font-weight', '600')
    .style('fill', '#003366')
    .text('Year');

  g.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -55)
    .attr('text-anchor', 'middle')
    .style('font-size', '14px')
    .style('font-weight', '600')
    .style('fill', '#003366')
    .text('Total Fines');

  const jurisdictionsWanted = ['NSW','QLD','VIC','TAS'];
  // ACT optional if present

  function parse(d){
    return {
      YEAR: +d.YEAR,
      JURISDICTION: (d.JURISDICTION||'').trim(),
      TOTAL_FINES: +d.TOTAL_FINES
    };
  }

  d3.csv(CSV, parse).then(raw => {
    // aggregate per jurisdiction-year
    const rolled = d3.rollup(raw, v => d3.sum(v, d => d.TOTAL_FINES), d => d.JURISDICTION, d => d.YEAR);

    const jurList = jurisdictionsWanted.filter(j => rolled.has(j));
    if (rolled.has('ACT')) jurList.push('ACT');

    const dataByJur = jurList.map(j => {
      const yearsMap = rolled.get(j) || new Map();
      const arr = Array.from(yearsMap.entries()).map(([yr, total]) => ({YEAR: +yr, TOTAL_FINES: +total}));
      return {jurisdiction: j, values: arr.sort((a,b)=>a.YEAR-b.YEAR)};
    });

    // get all years present across dataset
    const allYears = Array.from(new Set(raw.map(d=>d.YEAR))).sort((a,b)=>a-b);
    x.domain(d3.extent(allYears));

    const maxY = d3.max(dataByJur.flatMap(d=>d.values.map(v=>v.TOTAL_FINES)));
    y.domain([0, maxY]).nice();

    xAxisG.call(d3.axisBottom(x).tickFormat(d3.format('d')).ticks(allYears.length));
    yAxisG.call(d3.axisLeft(y));

    color.domain(dataByJur.map(d=>d.jurisdiction));

    const line = d3.line()
      .defined(d=>d.TOTAL_FINES!=null)
      .x(d=>x(d.YEAR))
      .y(d=>y(d.TOTAL_FINES));

    // draw lines
    const series = g.selectAll('.series').data(dataByJur).enter().append('g').attr('class','series');

    series.append('path')
      .attr('class','line')
      .attr('d', d => line(d.values))
      .attr('fill','none')
      .attr('stroke', d => color(d.jurisdiction))
      .attr('stroke-width', 2.5);

    // points + tooltip (Q5-scoped tooltip)
    const tooltip = d3.select('body').append('div').attr('class','chart-tooltip q5-tooltip').style('display','none');

    series.selectAll('.pt')
      .data(d => d.values.map(v => ({jur: d.jurisdiction, YEAR: v.YEAR, TOTAL_FINES: v.TOTAL_FINES})))
      .enter().append('circle')
      .attr('class','pt')
      .attr('r',3.5)
      .attr('cx', d => x(d.YEAR))
      .attr('cy', d => y(d.TOTAL_FINES))
      .attr('fill', d => color(d.jur))
      .on('mouseover', (event,d) => {
        tooltip.style('display','block').html(`<strong>${d.jur}</strong><br/>Year: ${d.YEAR}<br/>Fines: ${d.TOTAL_FINES}`);
      })
      .on('mousemove', (event) => tooltip.style('left', (event.pageX+10)+'px').style('top',(event.pageY-10)+'px'))
      .on('mouseout', () => tooltip.style('display','none'));

    // legend
    const legend = d3.select('#q5-legend');
    legend.html('');
    const legendList = legend.append('div').attr('class','legend-list');

    dataByJur.forEach(d => {
      const item = legendList.append('div').attr('class','legend-entry');
      item.append('input').attr('type','checkbox').property('checked', true).attr('data-j', d.jurisdiction);
      item.append('span').style('display','inline-block').style('width','12px').style('height','12px').style('background', color(d.jurisdiction)).style('margin','0 8px');
      item.append('span').text(d.jurisdiction);
    });

    function render(){
      const visible = new Set();
      d3.selectAll('#q5-legend input[type=checkbox]').each(function(){ if (this.checked) visible.add(this.getAttribute('data-j')); });

      g.selectAll('.series').style('display', d => visible.has(d.jurisdiction) ? null : 'none');
    }

    d3.selectAll('#q5-legend input[type=checkbox]').on('change', () => render());

  }).catch(err => {
    console.error('Failed to load CSV for Q5', err);
    svg.append('text').attr('x',20).attr('y',20).text('Failed to load data — check console');
  });

})();
