/*Q5 INTERACTIVE SLOPE GRAPH*/
(function() {

    const CSV = "data/mobile_phone_cleaned.csv";
  
    const margin = { top: 140, right: 220, bottom: 60, left: 220 },
          width = 1000 - margin.left - margin.right,
          baseHeight = 600;
  
    let selectedJurisdiction = null;
  
    const tooltip = d3.select("body").append("div")
        .attr("id", "q5-tooltip")
        .style("position", "absolute")
        .style("opacity", 0);
  
    const svg = d3.select("#q5-slope")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", baseHeight + margin.top + margin.bottom);
  
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
  
    // Color scale - diverging (green = decrease, red = increase)
    const colorScale = d3.scaleLinear()
      .domain([-40000, 0, 120000])
      .range(["#1a9850", "#ffffbf", "#d73027"])
      .interpolate(d3.interpolateHcl);
  
    d3.csv(CSV).then(raw => {
  
      raw.forEach(d => {
        d.YEAR = +d.YEAR;
        d.TOTAL_FINES = +d.TOTAL_FINES;
      });
  
      // Aggregate by jurisdiction and year (sum police + camera)
      const rolled = d3.rollup(
        raw,
        v => d3.sum(v, d => d.TOTAL_FINES),
        d => d.JURISDICTION,
        d => d.YEAR
      );
  
      const jurisdictions = [...rolled.keys()];
      
      let slopeData = jurisdictions.map(j => {
        const yearMap = rolled.get(j) || new Map();
        const start = yearMap.get(2008) || 0;
        const end = yearMap.get(2024) || 0;
        return {
          jurisdiction: j,
          start: start,
          end: end,
          change: end - start,
          percentChange: start > 0 ? ((end - start) / start) * 100 : 0
        };
      });
  
      const height = baseHeight;
  
      // Create SORTED lists for positioning (descending = highest at top)
      const sortedBy2008 = [...slopeData].sort((a, b) => b.start - a.start);
      const sortedBy2024 = [...slopeData].sort((a, b) => b.end - a.end);
  
      // Scales - use point scale with sorted domains
      const yScaleStart = d3.scalePoint()
        .domain(sortedBy2008.map(d => d.jurisdiction))
        .range([0, height])
        .padding(0.5);
  
      const yScaleEnd = d3.scalePoint()
        .domain(sortedBy2024.map(d => d.jurisdiction))
        .range([0, height])
        .padding(0.5);
  
      const xPositions = {
        start: 0,
        end: width
      };
  
      // Grid lines - light background
      const gridGroup = g.append("g").attr("class", "grid");
      for (let i = 0; i <= 10; i++) {
        const y = (height / 10) * i;
        gridGroup.append("line")
          .attr("x1", -15)
          .attr("x2", width + 15)
          .attr("y1", y)
          .attr("y2", y)
          .attr("stroke", "#e5e5e5")
          .attr("stroke-width", 1)
          .attr("opacity", 0.5);
      }
  
      // Title
      svg.append("text")
        .attr("x", (width + margin.left + margin.right) / 2)
        .attr("y", 40)
        .attr("text-anchor", "middle")
        .style("font-size", "24px")
        .style("font-weight", "700")
        .style("fill", "#003366")
        .text("Mobile Phone Fines: 2008 → 2024");
  
      svg.append("text")
        .attr("x", (width + margin.left + margin.right) / 2)
        .attr("y", 68)
        .attr("text-anchor", "middle")
        .style("font-size", "13px")
        .attr("fill", "#666")
        .text("Click any line to focus • Hover for details");
  
      // Column headers
      g.append("text")
        .attr("x", xPositions.start)
        .attr("y", -50)
        .attr("text-anchor", "middle")
        .style("font-size", "20px")
        .style("font-weight", "700")
        .style("fill", "#003366")
        .text("2008");
  
      g.append("text")
        .attr("x", xPositions.end)
        .attr("y", -50)
        .attr("text-anchor", "middle")
        .style("font-size", "20px")
        .style("font-weight", "700")
        .style("fill", "#003366")
        .text("2024");
  
      // Key insights - separated to avoid overlap
      const best = [...slopeData].sort((a, b) => a.change - b.change)[0];
      const worst = [...slopeData].sort((a, b) => b.change - a.change)[0];
  
      g.append("text")
        .attr("x", xPositions.start + 20)
        .attr("y", -20)
        .attr("text-anchor", "start")
        .style("font-size", "13px")
        .style("font-weight", "600")
        .style("fill", "#1a9850")
        .text(`✓ Best: ${best.jurisdiction} (${d3.format(",")(Math.abs(best.change))} fewer)`);
  
      g.append("text")
        .attr("x", xPositions.end - 20)
        .attr("y", -20)
        .attr("text-anchor", "end")
        .style("font-size", "13px")
        .style("font-weight", "600")
        .style("fill", "#d73027")
        .text(`✗ Worst: ${worst.jurisdiction} (+${d3.format(",")(worst.change)})`);
  
      // Draw everything
      const lineGroup = g.append("g").attr("class", "lines");
      const circleGroup = g.append("g").attr("class", "circles");
      const labelGroup = g.append("g").attr("class", "labels");
  
      function updateOpacity() {
        slopeData.forEach(d => {
          const isActive = selectedJurisdiction === d.jurisdiction;
          const isFaded = selectedJurisdiction && !isActive;
          const opacity = isFaded ? 0.1 : (isActive ? 1 : 0.8);
          const strokeWidth = isActive ? 5 : 3;
          const circleRadius = isActive ? 8 : 5.5;
          const fontSize = isActive ? "15px" : "13px";
          const fontWeight = isActive ? "700" : "600";
          const textColor = isFaded ? "#ccc" : "#003366";
  
          // Update line
          lineGroup.select(`#line-${d.jurisdiction.replace(/\s/g, '')}`)
            .attr("opacity", opacity)
            .attr("stroke-width", strokeWidth);
  
          // Update circles
          circleGroup.selectAll(`circle[data-jurisdiction="${d.jurisdiction}"]`)
            .attr("opacity", isFaded ? 0.15 : 1)
            .attr("r", circleRadius);
  
          // Update labels
          labelGroup.selectAll(`text[data-jurisdiction="${d.jurisdiction}"]`)
            .attr("opacity", isFaded ? 0.2 : 1)
            .style("font-size", fontSize)
            .style("font-weight", fontWeight)
            .attr("fill", textColor);
        });
      }
  
      // Draw lines
      slopeData.forEach(d => {
        lineGroup.append("line")
          .attr("id", `line-${d.jurisdiction.replace(/\s/g, '')}`)
          .attr("class", "slope-line")
          .attr("x1", xPositions.start)
          .attr("y1", yScaleStart(d.jurisdiction))
          .attr("x2", xPositions.end)
          .attr("y2", yScaleEnd(d.jurisdiction))
          .attr("stroke", colorScale(d.change))
          .attr("stroke-width", 3)
          .attr("opacity", 0.8)
          .style("cursor", "pointer")
          .on("mouseenter", function() {
            if (!selectedJurisdiction) {
              d3.select(this).attr("stroke-width", 4.5).attr("opacity", 1);
            }
            tooltip.style("opacity", 1)
              .html(`
                <strong style="font-size: 16px; color: #003366;">${d.jurisdiction}</strong><br><br>
                <strong>2008:</strong> ${d3.format(",")(d.start)} fines<br>
                <strong>2024:</strong> ${d3.format(",")(d.end)} fines<br>
                <strong>Change:</strong> <span style="color: ${d.change > 0 ? '#d73027' : '#1a9850'}; font-weight: 700;">${d.change > 0 ? '+' : ''}${d3.format(",")(d.change)}</span><br>
                <strong>% Change:</strong> ${d3.format(".1f")(d.percentChange)}%
              `);
          })
          .on("mousemove", function(event) {
            tooltip
              .style("left", (event.pageX + 15) + "px")
              .style("top", (event.pageY - 20) + "px");
          })
          .on("mouseleave", function() {
            if (!selectedJurisdiction) {
              d3.select(this).attr("stroke-width", 3).attr("opacity", 0.8);
            }
            tooltip.style("opacity", 0);
          })
          .on("click", function(event) {
            event.stopPropagation();
            selectedJurisdiction = selectedJurisdiction === d.jurisdiction ? null : d.jurisdiction;
            updateOpacity();
          });
      });
  
      // Draw circles
      slopeData.forEach(d => {
        // Start circle
        circleGroup.append("circle")
          .attr("data-jurisdiction", d.jurisdiction)
          .attr("cx", xPositions.start)
          .attr("cy", yScaleStart(d.jurisdiction))
          .attr("r", 5.5)
          .attr("fill", colorScale(d.change))
          .attr("stroke", "#fff")
          .attr("stroke-width", 2.5)
          .attr("opacity", 1)
          .style("cursor", "pointer")
          .on("mouseenter", function() {
            tooltip.style("opacity", 1)
              .html(`
                <strong style="font-size: 16px; color: #003366;">${d.jurisdiction}</strong><br><br>
                <strong>2008:</strong> ${d3.format(",")(d.start)} fines<br>
                <strong>2024:</strong> ${d3.format(",")(d.end)} fines<br>
                <strong>Change:</strong> <span style="color: ${d.change > 0 ? '#d73027' : '#1a9850'}; font-weight: 700;">${d.change > 0 ? '+' : ''}${d3.format(",")(d.change)}</span><br>
                <strong>% Change:</strong> ${d3.format(".1f")(d.percentChange)}%

              `);
          })
          .on("mousemove", function(event) {
            tooltip
              .style("left", (event.pageX + 15) + "px")
              .style("top", (event.pageY - 20) + "px");
          })
          .on("mouseleave", function() {
            tooltip.style("opacity", 0);
          })
          .on("click", function(event) {
            event.stopPropagation();
            selectedJurisdiction = selectedJurisdiction === d.jurisdiction ? null : d.jurisdiction;
            updateOpacity();
          });
  
        // End circle
        circleGroup.append("circle")
          .attr("data-jurisdiction", d.jurisdiction)
          .attr("cx", xPositions.end)
          .attr("cy", yScaleEnd(d.jurisdiction))
          .attr("r", 5.5)
          .attr("fill", colorScale(d.change))
          .attr("stroke", "#fff")
          .attr("stroke-width", 2.5)
          .attr("opacity", 1)
          .style("cursor", "pointer")
          .on("mouseenter", function() {
            tooltip.style("opacity", 1)
              .html(`
                <strong style="font-size: 16px; color: #003366;">${d.jurisdiction}</strong><br><br>
                <strong>2008:</strong> ${d3.format(",")(d.start)} fines<br>
                <strong>2024:</strong> ${d3.format(",")(d.end)} fines<br>
                <strong>Change:</strong> <span style="color: ${d.change > 0 ? '#d73027' : '#1a9850'}; font-weight: 700;">${d.change > 0 ? '+' : ''}${d3.format(",")(d.change)}</span><br>
                <strong>% Change:</strong> ${d3.format(".1f")(d.percentChange)}%

              `);
          })
          .on("mousemove", function(event) {
            tooltip
              .style("left", (event.pageX + 15) + "px")
              .style("top", (event.pageY - 20) + "px");
          })
          .on("mouseleave", function() {
            tooltip.style("opacity", 0);
          })
          .on("click", function(event) {
            event.stopPropagation();
            selectedJurisdiction = selectedJurisdiction === d.jurisdiction ? null : d.jurisdiction;
            updateOpacity();
          });
      });
  
    
      slopeData.forEach(d => {
        labelGroup.append("text")
          .attr("data-jurisdiction", d.jurisdiction)
          .attr("x", xPositions.start - 20)
          .attr("y", yScaleStart(d.jurisdiction))
          .attr("text-anchor", "end")
          .attr("dominant-baseline", "middle")
          .style("font-size", "13px")
          .style("font-weight", "600")
          .attr("fill", "#003366")
          .text(`${d.jurisdiction}: ${d3.format(",")(d.start)}`)
          .style("cursor", "pointer")
          .on("mouseenter", function() {
            tooltip.style("opacity", 1)
              .html(`
                <strong style="font-size: 16px; color: #003366;">${d.jurisdiction}</strong><br><br>
                <strong>2008:</strong> ${d3.format(",")(d.start)} fines<br>
                <strong>2024:</strong> ${d3.format(",")(d.end)} fines<br>
                <strong>Change:</strong> <span style="color: ${d.change > 0 ? '#d73027' : '#1a9850'}; font-weight: 700;">${d.change > 0 ? '+' : ''}${d3.format(",")(d.change)}</span><br>
                <strong>% Change:</strong> ${d3.format(".1f")(d.percentChange)}%

              `);
          })
          .on("mousemove", function(event) {
            tooltip
              .style("left", (event.pageX + 15) + "px")
              .style("top", (event.pageY - 20) + "px");
          })
          .on("mouseleave", function() {
            tooltip.style("opacity", 0);
          })
          .on("click", function(event) {
            event.stopPropagation();
            selectedJurisdiction = selectedJurisdiction === d.jurisdiction ? null : d.jurisdiction;
            updateOpacity();
          });
      });
  
      // Labels - Right side (2024) - positioned at LINE Y coordinates
      slopeData.forEach(d => {
        const changeSymbol = d.change > 0 ? '↑' : d.change < 0 ? '↓' : '→';
        
        labelGroup.append("text")
          .attr("data-jurisdiction", d.jurisdiction)
          .attr("x", xPositions.end + 20)
          .attr("y", yScaleEnd(d.jurisdiction))
          .attr("text-anchor", "start")
          .attr("dominant-baseline", "middle")
          .style("font-size", "13px")
          .style("font-weight", "600")
          .attr("fill", "#003366")
          .text(`${d3.format(",")(d.end)} ${changeSymbol} ${d3.format(",")(Math.abs(d.change))}`)
          .style("cursor", "pointer")
          .on("mouseenter", function() {
            tooltip.style("opacity", 1)
              .html(`
                <strong style="font-size: 16px; color: #003366;">${d.jurisdiction}</strong><br><br>
                <strong>2008:</strong> ${d3.format(",")(d.start)} fines<br>
                <strong>2024:</strong> ${d3.format(",")(d.end)} fines<br>
                <strong>Change:</strong> <span style="color: ${d.change > 0 ? '#d73027' : '#1a9850'}; font-weight: 700;">${d.change > 0 ? '+' : ''}${d3.format(",")(d.change)}</span><br>
                <strong>% Change:</strong> ${d3.format(".1f")(d.percentChange)}%

              `);
          })
          .on("mousemove", function(event) {
            tooltip
              .style("left", (event.pageX + 15) + "px")
              .style("top", (event.pageY - 20) + "px");
          })
          .on("mouseleave", function() {
            tooltip.style("opacity", 0);
          })
          .on("click", function(event) {
            event.stopPropagation();
            selectedJurisdiction = selectedJurisdiction === d.jurisdiction ? null : d.jurisdiction;
            updateOpacity();
          });
      });
  
      // Click background to deselect
      svg.on("click", function() {
        if (selectedJurisdiction) {
          selectedJurisdiction = null;
          updateOpacity();
        }
      });
  
    }).catch(err => {
      console.error("Error loading CSV:", err);
      d3.select("#q5-slope").append("p")
        .style("color", "red")
        .style("padding", "20px")
        .text("Error loading data. Please check the file path: " + CSV);
    });
  
  })();