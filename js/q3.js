// q3.js — simplified choropleth + bar chart for offence rates per 10k licences
(function(){
  const dataFile = 'data/mobile_phone_cleaned.csv';
  const mapTarget = '#map';
  const barSvg = d3.select('#barChart');
  const mapDiv = d3.select(mapTarget);

  const width = 720;
  const height = 520;
  const barHeight = 420;
  const barMargin = {top: 30, right: 20, bottom: 60, left: 120};

  const mapSvg = mapDiv.append('svg').attr('width', width).attr('height', height);
  // group that contains all map shapes — we'll apply zoom/pan to this group
  const mapLayer = mapSvg.append('g').attr('class', 'map-layer');

  // attach zoom behaviour to the SVG; transforms will be applied to `mapLayer`
  const zoom = d3.zoom().scaleExtent([1, 8]).on('zoom', (event) => {
    mapLayer.attr('transform', event.transform);
  });
  mapSvg.call(zoom).style('cursor', 'grab');

  // jurisdictions in consistent order
  const jurisdictions = ['NSW','QLD','VIC','TAS','SA','WA','NT','ACT'];

  // shapes for simplified map (adjusted so regions touch/appear contiguous)
  const shapes = [
    // WA — left column tall
    { id: 'WA', name: 'Western Australia', x: 8, y: 60, w: 220, h: 520 },
    // NT above SA, touching WA
    { id: 'NT', name: 'Northern Territory', x: 230, y: 60, w: 180, h: 160 },
    // QLD on the right, tall
    { id: 'QLD', name: 'Queensland', x: 420, y: 60, w: 200, h: 360 },
    // SA below NT, touching WA and QLD
    { id: 'SA', name: 'South Australia', x: 230, y: 220, w: 180, h: 200 },
    // NSW to the east of SA
    { id: 'NSW', name: 'New South Wales', x: 420, y: 240, w: 200, h: 180 },
    // VIC below NSW
    { id: 'VIC', name: 'Victoria', x: 420, y: 420, w: 200, h: 120 },
    // TAS small island below VIC
    { id: 'TAS', name: 'Tasmania', x: 480, y: 540, w: 80, h: 36 },
    // ACT small near NSW (approx)
    { id: 'ACT', name: 'Australian Capital Territory', x: 490, y: 300, w: 18, h: 12 }
  ];

  // load and precompute per-year aggregated rates
  d3.csv(dataFile).then(raw => {
    raw.forEach(d => {
      d.YEAR = +d.YEAR;
      d.TOTAL_FINES = +d.TOTAL_FINES || 0;
      d.LICENCE_TOTAL = d.LICENCE_TOTAL ? +d.LICENCE_TOTAL : null;
      d.FINES_PER_10K_LICENCES = d.FINES_PER_10K_LICENCES ? +d.FINES_PER_10K_LICENCES : null;
    });

    const years = Array.from(new Set(raw.map(d=>d.YEAR))).sort((a,b)=>a-b);
    const minYear = d3.min(years);
    const maxYear = d3.max(years);

    // precompute map: year -> array of {jurisdiction, rate, totalFines, licence}
    const perYear = new Map();
    years.forEach(year => {
      const agg = new Map();
      jurisdictions.forEach(j => agg.set(j, {totalFines:0, licence: null}));
      raw.filter(d => d.YEAR === year).forEach(d => {
        const cur = agg.get(d.JURISDICTION) || {totalFines:0, licence: null};
        cur.totalFines = (cur.totalFines || 0) + (d.TOTAL_FINES || 0);
        if(d.LICENCE_TOTAL) cur.licence = d.LICENCE_TOTAL;
        agg.set(d.JURISDICTION, cur);
      });
      const arr = Array.from(agg.entries()).map(([j, v]) => {
        let rate = null;
        if(v.licence && v.licence > 0) rate = (v.totalFines / v.licence) * 10000;
        if(rate === null){
          const rows = raw.filter(r => r.YEAR === year && r.JURISDICTION === j);
          const summed = d3.sum(rows, r => r.FINES_PER_10K_LICENCES || 0);
          rate = summed || 0;
        }
        return {jurisdiction: j, rate: rate, totalFines: v.totalFines, licence: v.licence};
      });
      perYear.set(year, arr);
    });

    // compute a fixed (global) color scale across all years so colors remain consistent
    const allRatesFlat = Array.from(perYear.values()).flat().map(d => d.rate).filter(r => typeof r === 'number' && !isNaN(r));
    let globalMinRate = d3.min(allRatesFlat);
    let globalMaxRate = d3.max(allRatesFlat);
    if(globalMinRate === globalMaxRate){ // avoid degenerate domain
      globalMaxRate = globalMinRate + 1;
    }
    const colorScale = d3.scaleSequential(d3.interpolateOrRd).domain([globalMinRate, globalMaxRate]);

    // build initial UI controls (slider only)
    const slider = document.getElementById('yearSlider');
    const yearDisplay = document.getElementById('yearDisplay');

    slider.min = minYear; slider.max = maxYear; slider.value = maxYear; yearDisplay.textContent = slider.value;

    slider.addEventListener('input', () => {
      yearDisplay.textContent = slider.value;
      render(+slider.value);
    });

    // tooltip
    const tip = d3.select('body').append('div').attr('class','chart-tooltip').style('display','none');
    function showTooltip(x,y,html){ tip.html(html).style('left',(x+12)+'px').style('top',(y+12)+'px').style('display','block'); }
    function moveTooltip(x,y){ tip.style('left',(x+12)+'px').style('top',(y+12)+'px'); }
    function hideTooltip(){ tip.style('display','none'); }

    // render function for a chosen year
    function render(year){
      const data = perYear.get(year).slice();
      data.sort((a,b) => b.rate - a.rate);
      const rates = data.map(d=>d.rate);
      const color = colorScale; // use global fixed color scale

      // update map colors — support GeoJSON features if loaded, otherwise fall back to simple rectangles
      const rateById = new Map(data.map(d=>[d.jurisdiction, d.rate]));

      if(window.__q3_geo && window.__q3_geo.features){
        const features = window.__q3_geo.features;
        // Helper to map feature -> jurisdiction code (prefer iso_3166_2)
        const nameToCode = {
          'New South Wales': 'NSW',
          'Queensland': 'QLD',
          'Victoria': 'VIC',
          'Tasmania': 'TAS',
          'South Australia': 'SA',
          'Western Australia': 'WA',
          'Northern Territory': 'NT',
          'Australian Capital Territory': 'ACT'
        };

        const getCode = f => {
          if(!f || !f.properties) return null;
          const iso = f.properties.iso_3166_2;
          if(iso){
            // iso might be 'AU-NSW' — take last part (NSW)
            const parts = String(iso).split('-');
            return parts[parts.length-1].toUpperCase();
          }
          if(nameToCode[f.properties.name]) return nameToCode[f.properties.name];
          return null;
        };

        const paths = mapLayer.selectAll('path.region').data(features, d => getCode(d) || d.id || d.properties && d.properties.name);
        paths.join(
          enter => enter.append('path')
            .attr('class','region')
            .attr('d', d => window.__q3_path(d))
            .attr('stroke', '#333')
            .attr('stroke-width', 0.6)
            .on('mouseover', (event,d) => {
              const code = getCode(d);
              const label = d.properties && d.properties.name ? d.properties.name : code || 'Unknown';
              const rate = rateById.get(code);
              const rateText = (typeof rate === 'number' && !isNaN(rate)) ? d3.format('.2f')(rate) : 'N/A';
              showTooltip(event.pageX, event.pageY, `${label} (${code||''})<br/>Rate: ${rateText}`);
            })
            .on('mousemove', (event) => moveTooltip(event.pageX, event.pageY))
            .on('mouseout', hideTooltip)
            .call(sel => sel.transition().duration(300).attr('fill', d => color(rateById.get(getCode(d))||0))),
          update => update.call(sel => sel.transition().duration(300).attr('d', d => window.__q3_path(d)).attr('fill', d => color(rateById.get(getCode(d))||0))),
          exit => exit.remove()
        );

        // rebind tooltip events on all paths so handlers reference the latest rateById
        mapLayer.selectAll('path.region')
          .on('mouseover', (event,d) => {
            const code = getCode(d);
            const label = d.properties && d.properties.name ? d.properties.name : code || 'Unknown';
            const rate = rateById.get(code);
            const rateText = (typeof rate === 'number' && !isNaN(rate)) ? d3.format('.2f')(rate) : 'N/A';
            showTooltip(event.pageX, event.pageY, `${label} (${code||''})<br/>Rate: ${rateText}`);
          })
          .on('mousemove', (event) => moveTooltip(event.pageX, event.pageY))
          .on('mouseout', hideTooltip);

        // remove any old placeholder rectangles/labels
        // remove any old placeholder rectangles/labels from the map layer
        mapLayer.selectAll('rect.region').remove();
        mapLayer.selectAll('text.label').remove();
      } else {
        // fallback: simple rectangles (existing behaviour)
        const regions = mapLayer.selectAll('rect.region').data(shapes, d=>d.id);
        regions.join(
          enter => enter.append('rect')
            .attr('class','region')
            .attr('x', d=>d.x)
            .attr('y', d=>d.y)
            .attr('width', d=>d.w)
            .attr('height', d=>d.h)
            .attr('stroke', '#333')
            .attr('stroke-width', 0.6)
            .on('mouseover', (event,d) => {
              const rate = rateById.get(d.id);
              const rateText = (typeof rate === 'number' && !isNaN(rate)) ? d3.format('.2f')(rate) : 'N/A';
              showTooltip(event.pageX, event.pageY, `${d.name} (${d.id})<br/>Rate: ${rateText}`);
            })
            .on('mousemove', (event) => moveTooltip(event.pageX, event.pageY))
            .on('mouseout', hideTooltip)
            .call(sel => sel.transition().duration(300).attr('fill', d => color(rateById.get(d.id)||0))),
          update => update.call(sel => sel.transition().duration(300).attr('fill', d => color(rateById.get(d.id)||0))),
          exit => exit.remove()
        );

        // rebind tooltip events for fallback rects as well (so they reflect updated rates)
        mapLayer.selectAll('rect.region')
          .on('mouseover', (event,d) => {
            const rate = rateById.get(d.id);
            const rateText = (typeof rate === 'number' && !isNaN(rate)) ? d3.format('.2f')(rate) : 'N/A';
            showTooltip(event.pageX, event.pageY, `${d.name} (${d.id})<br/>Rate: ${rateText}`);
          })
          .on('mousemove', (event) => moveTooltip(event.pageX, event.pageY))
          .on('mouseout', hideTooltip);

        // labels
        const labs = mapLayer.selectAll('text.label').data(shapes, d=>d.id);
        labs.join(
          enter => enter.append('text').attr('class','label').attr('x', d=>d.x+6).attr('y', d=>d.y+14).attr('font-size',11).attr('fill','#002').text(d=>d.id),
          update => update,
          exit => exit.remove()
        );
      }

      // update legend
      d3.select('#map-legend').selectAll('*').remove();
      const legendWidth = 220;
      const legendSvg = d3.select('#map-legend').append('svg').attr('width', legendWidth).attr('height', 50);
      const defs = legendSvg.append('defs');
      const linearGrad = defs.append('linearGradient').attr('id','grad-'+year).attr('x1','0%').attr('x2','100%');
      linearGrad.append('stop').attr('offset','0%').attr('stop-color', color(globalMinRate));
      linearGrad.append('stop').attr('offset','100%').attr('stop-color', color(globalMaxRate));
      legendSvg.append('rect').attr('x',0).attr('y',6).attr('width',legendWidth).attr('height',12).style('fill',`url(#grad-${year})`).style('stroke','#ccc');
      legendSvg.append('text').attr('x',0).attr('y',26).text(d3.format('.2f')(globalMinRate)).attr('font-size',12).attr('fill','#333');
      legendSvg.append('text').attr('x',legendWidth).attr('y',26).text(d3.format('.2f')(globalMaxRate)).attr('font-size',12).attr('fill','#333').attr('text-anchor','end');

      // Bar chart
      const bwidth = Math.min(760, window.innerWidth - 60);
      const bheight = barHeight;
      barSvg.selectAll('*').remove();
      barSvg.attr('viewBox', `0 0 ${bwidth} ${bheight}`).attr('preserveAspectRatio','xMidYMid meet');
      const bx = d3.scaleLinear().domain([0, d3.max(data, d=>d.rate)]).range([0, bwidth - barMargin.left - barMargin.right]);
      const by = d3.scaleBand().domain(data.map(d=>d.jurisdiction)).range([0, bheight - barMargin.top - barMargin.bottom]).padding(0.15);
      const bG = barSvg.append('g').attr('transform', `translate(${barMargin.left},${barMargin.top})`);
      bG.append('g').call(d3.axisLeft(by));

            // Y-axis label
      bG.append('text')
      .attr('class', 'axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -(bheight - barMargin.top - barMargin.bottom) / 2)
      .attr('y', -80)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', '600')
      .style('fill', '#003366')
      .text('Jurisdiction');

      bG.selectAll('.bar').data(data).enter().append('rect')
        .attr('class','bar')
        .attr('x', 0)
        .attr('y', d=>by(d.jurisdiction))
        .attr('height', by.bandwidth())
        .attr('width', 0)
        .attr('fill', d=>color(d.rate))
        .on('mouseover', (event,d) => {
          const rate = d.rate;
          const rateText = (typeof rate === 'number' && !isNaN(rate)) ? d3.format('.2f')(rate) : 'N/A';
          showTooltip(event.pageX, event.pageY, `${d.jurisdiction}<br/>Rate: ${rateText}`);
        })
        .on('mousemove', (event) => moveTooltip(event.pageX, event.pageY))
        .on('mouseout', hideTooltip)
        .transition().duration(500).attr('width', d=>bx(d.rate));
      const bxAxis = d3.axisBottom(bx).ticks(6);
      bG.append('g').attr('transform', `translate(0, ${bheight - barMargin.top - barMargin.bottom})`).call(bxAxis);

            // X-axis label
      bG.append('text')
      .attr('class', 'axis-label')
      .attr('x', (bwidth - barMargin.left - barMargin.right) / 2)
      .attr('y', bheight - barMargin.top - barMargin.bottom + 45)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', '600')
      .style('fill', '#003366')
      .text('Fines per 10,000 Licence Holders');

      // highest / lowest
      const nonZero = data.filter(d=>!isNaN(d.rate));
      const highest = d3.max(nonZero, d=>d.rate);
      const lowest = d3.min(nonZero, d=>d.rate);
      const highestJur = nonZero.find(d=>d.rate===highest).jurisdiction;
      const lowestJur = nonZero.find(d=>d.rate===lowest).jurisdiction;
      d3.select('.q3-answer').remove();
      d3.select('header').append('p').attr('class','q3-answer').html(`<strong>Highest:</strong> ${highestJur} (${d3.format('.2f')(highest)} per 10,000) &nbsp; <strong>Lowest:</strong> ${lowestJur} (${d3.format('.2f')(lowest)} per 10,000)`);
    }

    // try to load a local GeoJSON for Australia; fall back to the GitHub raw URL if local file not present
    const geoLocal = 'data/aus_states.geojson';
    const geoRemote = 'https://raw.githubusercontent.com/codeforgermany/click_that_hood/master/public/data/australia.geojson';
    d3.json(geoLocal).catch(() => d3.json(geoRemote)).then(geo => {
      try{
        // store geo for render to pick up
        window.__q3_geo = geo;
        // create projection & path and attach globally for render()
        const proj = d3.geoMercator().fitSize([width, height], geo);
        window.__q3_path = d3.geoPath().projection(proj);
      }catch(e){
        console.warn('GeoJSON load succeeded but path creation failed', e);
        window.__q3_geo = null;
      }
      // re-render for current slider value (or maxYear as default)
      const current = +slider.value || maxYear;
      render(current);
    }).catch(err => {
      // if geo fails, keep placeholder map and render
      console.warn('Could not load GeoJSON (local or remote). Using placeholder map.', err);
      render(maxYear);
    });
  }).catch(err => {
    console.error('Error loading data:', err);
    d3.select(mapTarget).append('div').text('Failed to load data. Check console.');
  });
})();
