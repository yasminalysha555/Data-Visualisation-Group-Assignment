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

  // ✨ NEW: Add X-axis label
  inner.append('text')
    .attr('class', 'axis-label')
    .attr('x', width / 2)
    .attr('y', height + 40)
    .attr('text-anchor', 'middle')
    .style('font-size', '14px')
    .style('font-weight', '600')
    .style('fill', '#003366')
    .text('Year');

  // ✨ NEW: Add Y-axis label
  inner.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -60)
    .attr('text-anchor', 'middle')
    .style('font-size', '14px')
    .style('font-weight', '600')
    .style('fill', '#003366')
    .text('Total Fines');

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
    // Build a compact editor: single jurisdiction select and a single year select for camera intro
    const container = d3.select('#camera-editor');
    container.html('');
    const row = container.append('div').attr('class','camera-grid single');

    // no jurisdiction select in the editor – top selector determines jurisdiction

    row.append('label').attr('for','q4-editor-year').text('Camera intro year: ');
    const yrSel = row.append('select').attr('id','q4-editor-year');
    for (let yr = 2008; yr <= 2024; yr++) yrSel.append('option').attr('value', yr).text(yr);
    // set initial year based on the top jurisdiction selection (if any)
    const currentTopJur = d3.select('#q4-jur-select').empty() ? 'ALL' : d3.select('#q4-jur-select').property('value');
    if(currentTopJur && currentTopJur !== 'ALL') yrSel.property('value', cameraIntro[currentTopJur] || 2017);

    // when the editor jurisdiction selector existed we synced it with the top selector; now that the editor jur dropdown was removed
    // we do not need jurisdiction change handling in the editor. The top dropdown controls which jurisdiction is shown.
  }

  function updateCameraFromEditor(){
    // read the current selected jurisdiction from the top dropdown and the year from the editor and update mapping
    const jur = d3.select('#q4-jur-select').property('value');
    const yr = +d3.select('#q4-editor-year').property('value');
    if (jur && jur !== 'ALL' && !isNaN(yr)) cameraIntro[jur] = yr;
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

    // create a top jurisdiction dropdown in the controls area (makes it easier to find)
    const controlsLeft = d3.select('.q4-toolbar-left');
    // create a small container at top for jurisdiction selection
    const topJur = controlsLeft.append('div').attr('class','jur-selector');
    topJur.append('label').attr('for','q4-jur-select').text('Select jurisdiction: ');
    const jurSelect = topJur.append('select').attr('id','q4-jur-select');
    color.domain(jurisdictions);
    // add 'All' option first so user can see the full chart by default
    jurSelect.append('option').attr('value', 'ALL').text('All');
    jurisdictions.forEach(j => jurSelect.append('option').attr('value', j).text(j));
    // default selection: show all lines
    jurSelect.property('value', 'ALL');
    // disable the camera intro year picker when showing all jurisdictions
    d3.select('#q4-editor-year').property('disabled', true);
    // (no swatch) — color swatch removed; the dropdown is sufficient for selection
    // add the info box inside the controls area so it's visible at the top
    const infoBox = topJur.append('div').attr('class', 'q4-info');
    function updateInfoBox(){
      const v = jurSelect.property('value');
      if(v === 'ALL'){
        infoBox.html(`<strong>Selected:</strong> ALL &nbsp; <strong>Camera intro:</strong> —`);
      } else {
        const intro = (cameraIntro[v] || 'N/A');
        infoBox.html(`<strong>Selected:</strong> ${v} &nbsp; <strong>Camera intro:</strong> ${intro}`);
      }
    }
    updateInfoBox();

    // single tooltip for entire chart
    const tooltip = d3.select('body').append('div').attr('class','chart-tooltip').style('display','none');

    function render(){
      inner.selectAll('.jur-group').remove();
      // get the currently selected jurisdiction from the legend dropdown
      const selJur = d3.select('#q4-jur-select').property('value');
      // show all jurisdictions by default (value 'ALL'), otherwise show only the selected one
      const targetJurs = (selJur === 'ALL') ? jurisdictions.slice() : [selJur];

      targetJurs.forEach(j => {
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

        const isSelected = (selJur === 'ALL') ? false : true;
        // if showing all, use smaller strokes so the chart is readable; if showing only selected, emphasize
        const strokeOpacity = (selJur === 'ALL') ? 0.9 : 1;
        const strokeWidth = (selJur === 'ALL') ? 1.5 : 4;
        const circleRadius = (selJur === 'ALL') ? 2.5 : 4.5;

        const strokeColor = color(j);
        g.append('path')
          .datum(before)
          .attr('fill','none')
          .attr('stroke', strokeColor)
          .attr('stroke-width', strokeWidth)
          .attr('opacity', strokeOpacity)
          .attr('stroke-dasharray','6 4')
          .attr('d', lineGen);

        g.append('path')
          .datum(after)
          .attr('fill','none')
          .attr('stroke', strokeColor)
          .attr('stroke-width', strokeWidth)
          .attr('opacity', strokeOpacity)
          .attr('d', lineGen);

        g.selectAll('.pt')
          .data(arr.filter(d => d.TOTAL_FINES != null))
          .enter().append('circle')
          .attr('class','pt')
          .attr('r',circleRadius)
          .attr('cx', d => x(d.YEAR))
          .attr('cy', d => y(d.TOTAL_FINES))
          .attr('fill', color(j))
          .on('mouseover', (event,d) => {
            tooltip.style('display','block').html(`<strong>${j}</strong><br/>Year: ${d.YEAR}<br/>Fines: ${d.TOTAL_FINES}`);
          })
          .on('mousemove', (event) => tooltip.style('left', (event.pageX+10)+'px').style('top',(event.pageY-10)+'px'))
          .on('mouseout', () => tooltip.style('display','none'));
      });

          // update the info box next to the selector, rather than append below
            updateInfoBox();
    }

    render();

    d3.select('#q4-jur-select').on('change', () => {
      const v = d3.select('#q4-jur-select').property('value');
      // set the editor year to match the selected jurisdiction's cameraIntro if one is chosen
      if(v === 'ALL'){
        d3.select('#q4-editor-year').property('disabled', true);
      } else {
        d3.select('#q4-editor-year').property('disabled', false).property('value', cameraIntro[v] || 2017);
      }
      console.log('[q4] legend select changed ->', v);
      updateInfoBox();
      render();
    });
    // make updates automatic: when the camera intro year changes, update cameraIntro for the selected jurisdiction and re-render
    d3.select('#q4-editor-year').on('change', () => { updateCameraFromEditor(); console.log('[q4] editor year changed ->', d3.select('#q4-editor-year').property('value'), 'for', d3.select('#q4-jur-select').property('value')); updateInfoBox(); render(); });
    // no duplicate editor jurisdiction bindings — editor only edits camera year now.

  }).catch(err => {
    console.error('Failed to load CSV for Q4:', err);
    d3.select('#q4-svg').append('text').attr('x',20).attr('y',20).text('Failed to load data — check CSV path in js/q4.js');
  });

})();