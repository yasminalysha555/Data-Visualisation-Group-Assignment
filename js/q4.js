// q4.js — Before/After multi-line chart (solid = After, dashed = Before)
(function(){
  const CSV_PATH = 'data/mobile_phone_cleaned.csv';

  const svg = d3.select('#q4-svg');
  const rawW = +svg.attr('width');
  const rawH = +svg.attr('height');
  const margin = {top: 30, right: 20, bottom: 50, left: 80};

  const width = rawW - margin.left - margin.right;
  const height = rawH - margin.top - margin.bottom;

  const inner = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().range([0, width]);
  const y = d3.scaleLinear().range([height, 0]);

  const color = d3.scaleOrdinal(d3.schemeTableau10);

  const xAxisG = inner.append('g').attr('class','x-axis').attr('transform', `translate(0,${height})`);
  const yAxisG = inner.append('g').attr('class','y-axis');

  let cameraIntro = {
    'NSW': 2017,
    'QLD': 2017,
    'VIC': 2017,
    'TAS': 2017,
    'SA': 2017,
    'WA': 2017,
    'NT': 2017,
    'ACT': 2017
  };

  function parseRow(d){
    return {
      YEAR: +d.YEAR,
      JURISDICTION: (d.JURISDICTION || '').trim(),
      TOTAL_FINES: +d.TOTAL_FINES
    };
  }

  function buildCameraEditor(jurisdictions){
    // Render jurisdictions horizontally: labels on the first row, inputs on the second
    const container = d3.select('#camera-editor');
    container.html('');
    const grid = container.append('div').attr('class','camera-grid');

    // label row
    const labels = grid.append('div').attr('class','camera-row labels');
    // input row
    const inputs = grid.append('div').attr('class','camera-row inputs');

    jurisdictions.forEach(j => {
      labels.append('div').attr('class','camera-cell').text(j);
      const cell = inputs.append('div').attr('class','camera-cell');
      const select = cell.append('select').attr('data-jur', j);
      // years from 2008 to 2024
      for (let yr = 2008; yr <= 2024; yr++){
        select.append('option')
          .attr('value', yr)
          .property('selected', (cameraIntro[j] || 2017) === yr)
          .text(yr);
      }
    });
  }

  function updateCameraFromEditor(){
    d3.selectAll('#camera-editor select').each(function(){
      const sel = d3.select(this);
      const j = sel.attr('data-jur');
      const v = +sel.node().value;
      if (!isNaN(v)) cameraIntro[j] = v;
    });
  }

  d3.csv(CSV_PATH, parseRow).then(raw => {
    // Aggregate totals per jurisdiction-year to collapse multiple detection methods (camera + police)
    const roll = d3.rollup(raw,
      v => d3.sum(v, d => d.TOTAL_FINES),
      d => d.JURISDICTION,
      d => d.YEAR
    );

    const jurisdictions = Array.from(roll.keys()).sort();
    // build per-jurisdiction arrays with aggregated yearly totals
    const dataByJur = new Map();
    const allYearsSet = new Set();
    for (const [jur, yearMap] of roll.entries()){
      const arr = Array.from(yearMap.entries()).map(([year, total]) => ({YEAR: +year, TOTAL_FINES: +total})).sort((a,b)=>a.YEAR-b.YEAR);
      arr.forEach(d => allYearsSet.add(d.YEAR));
      dataByJur.set(jur, arr);
    }

    buildCameraEditor(jurisdictions);

    const years = Array.from(allYearsSet).sort((a,b)=>a-b);
    x.domain(d3.extent(years));
    // y domain should use the aggregated totals
    const maxTotal = d3.max(Array.from(dataByJur.values()).flat(), d => d.TOTAL_FINES);
    y.domain([0, maxTotal]).nice();

    xAxisG.call(d3.axisBottom(x).tickFormat(d3.format('d')).ticks(years.length));
    yAxisG.call(d3.axisLeft(y));

    // legend / toggles
    const legend = d3.select('#q4-legend');
    legend.html('');
    const legendList = legend.append('div').attr('class','legend-list');

    color.domain(jurisdictions);

    // default visible subset
    const defaultVisible = new Set(['NSW','QLD','VIC','TAS']);

    jurisdictions.forEach((j) => {
      const entry = legendList.append('div').attr('class','legend-entry');
      entry.append('input').attr('type','checkbox').property('checked', defaultVisible.has(j)).attr('data-j', j);
      entry.append('span').style('display','inline-block').style('width','12px').style('height','12px').style('background',color(j)).style('margin','0 6px');
      entry.append('span').text(j);
    });

    // single tooltip for entire chart
    const tooltip = d3.select('body').append('div').attr('class','chart-tooltip').style('display','none');

    function render(){
      inner.selectAll('.jur-group').remove();

      const visible = new Set();
      d3.selectAll('#q4-legend input[type=checkbox]').each(function(){ if (this.checked) visible.add(this.getAttribute('data-j')); });

      jurisdictions.forEach(j => {
        if (!visible.has(j)) return;
        const arr = (dataByJur.get(j) || []).slice().sort((a,b)=>a.YEAR-b.YEAR);
        if (!arr.length) return;

        const intro = cameraIntro[j] || 9999;

        // produce arrays aligned to the full 'years' domain so lines are continuous
        const before = years.map(yr => {
          const found = arr.find(d => d.YEAR === yr);
          return found ? (yr < intro ? {YEAR: yr, TOTAL_FINES: found.TOTAL_FINES} : {YEAR: yr, TOTAL_FINES: null}) : {YEAR: yr, TOTAL_FINES: null};
        });
        const after = years.map(yr => {
          const found = arr.find(d => d.YEAR === yr);
          return found ? (yr >= intro ? {YEAR: yr, TOTAL_FINES: found.TOTAL_FINES} : {YEAR: yr, TOTAL_FINES: null}) : {YEAR: yr, TOTAL_FINES: null};
        });

        const g = inner.append('g').attr('class','jur-group');

        const lineGen = d3.line()
          .defined(d => d.TOTAL_FINES != null)
          .x(d => x(d.YEAR))
          .y(d => y(d.TOTAL_FINES));

        g.append('path')
          .datum(before)
          .attr('fill','none')
          .attr('stroke', color(j))
          .attr('stroke-width', 2)
          .attr('stroke-dasharray','6 4')
          .attr('d', lineGen);

        g.append('path')
          .datum(after)
          .attr('fill','none')
          .attr('stroke', color(j))
          .attr('stroke-width', 2)
          .attr('d', lineGen);

        g.selectAll('.pt')
          .data(arr.filter(d => d.TOTAL_FINES != null))
          .enter().append('circle')
          .attr('class','pt')
          .attr('r',3)
          .attr('cx', d => x(d.YEAR))
          .attr('cy', d => y(d.TOTAL_FINES))
          .attr('fill', color(j))
          .on('mouseover', (event,d) => {
            tooltip.style('display','block').html(`<strong>${j}</strong><br/>Year: ${d.YEAR}<br/>Fines: ${d.TOTAL_FINES}`);
          })
          .on('mousemove', (event) => tooltip.style('left', (event.pageX+10)+'px').style('top',(event.pageY-10)+'px'))
          .on('mouseout', () => tooltip.style('display','none'));
      });
    }

    render();

    d3.selectAll('#q4-legend input[type=checkbox]').on('change', () => render());
    d3.select('#update-camera').on('click', () => { updateCameraFromEditor(); render(); });

  }).catch(err => {
    console.error('Failed to load CSV for Q4:', err);
    d3.select('#q4-svg').append('text').attr('x',20).attr('y',20).text('Failed to load data — check CSV path in js/q4.js');
  });

})();
