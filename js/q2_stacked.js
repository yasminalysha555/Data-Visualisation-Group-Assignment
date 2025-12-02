/*ENHANCED STACKED AREA CHART**/

const tooltip = d3.select("#tooltip");

const COLORS = {
  "Police issued": "#0072B2",  
  "Camera issued": "#D55E00"   
};

const METHODS = ["Police issued", "Camera issued"];

let rawData = [];
let metric = "TOTAL_FINES";
let viewMode = "absolute";
let hiddenSeries = new Set();

// Chart dimensions
const margin = { top: 60, right: 120, bottom: 120, left: 100 };
const width = 1100 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

// Load data
d3.csv("data/mobile_phone_cleaned.csv").then(data => {
  data.forEach(d => {
    d.YEAR = +d.YEAR;
    d.TOTAL_FINES = +d.TOTAL_FINES;
    d.FINES_PER_10K_LICENCES = +d.FINES_PER_10K_LICENCES || 0;
  });

  rawData = data;
  
  updateStats();
  setupControls();
  createLegend();
  drawStackedArea();
});

// Update statistics cards
function updateStats() {
  const policeTotal = d3.sum(rawData.filter(d => d.DETECTION_METHOD === "Police issued"), d => d.TOTAL_FINES);
  const cameraTotal = d3.sum(rawData.filter(d => d.DETECTION_METHOD === "Camera issued"), d => d.TOTAL_FINES);
  
  const yearlyTotals = d3.rollup(rawData, v => d3.sum(v, d => d.TOTAL_FINES), d => d.YEAR);
  const peakYear = [...yearlyTotals].reduce((a, b) => a[1] > b[1] ? a : b);
  
  const recent2024 = rawData.filter(d => d.YEAR === 2024);
  const camera2024 = d3.sum(recent2024.filter(d => d.DETECTION_METHOD === "Camera issued"), d => d.TOTAL_FINES);
  const total2024 = d3.sum(recent2024, d => d.TOTAL_FINES);
  const cameraShare = ((camera2024 / total2024) * 100).toFixed(1);
  
  document.getElementById("stat-police").textContent = policeTotal.toLocaleString();
  document.getElementById("stat-police-change").textContent = "2008-2024";
  
  document.getElementById("stat-camera").textContent = cameraTotal.toLocaleString();
  document.getElementById("stat-camera-change").textContent = "2020-2024";
  
  document.getElementById("stat-peak-year").textContent = peakYear[0];
  document.getElementById("stat-peak-value").textContent = peakYear[1].toLocaleString() + " fines";
  
  document.getElementById("stat-camera-share").textContent = cameraShare + "%";
}

// Setup controls
function setupControls() {
  document.querySelectorAll('input[name="q2-metric"]').forEach(radio => {
    radio.addEventListener("change", e => {
      metric = e.target.value;
      drawStackedArea();
    });
  });

  document.querySelectorAll('input[name="q2-view"]').forEach(radio => {
    radio.addEventListener("change", e => {
      viewMode = e.target.value;
      drawStackedArea();
    });
  });
}

// Create interactive legend
function createLegend() {
  const legendContainer = d3.select("#stacked-legend");
  
  METHODS.forEach(method => {
    const item = legendContainer.append("div")
      .attr("class", "legend-item")
      .style("color", COLORS[method])
      .on("click", () => toggleSeries(method));
    
    item.append("div")
      .attr("class", "legend-color")
      .style("background", COLORS[method]);
    
    item.append("div")
      .attr("class", "legend-label")
      .text(method);
  });
}

// Toggle series visibility
function toggleSeries(method) {
  if (hiddenSeries.has(method)) {
    hiddenSeries.delete(method);
  } else {
    hiddenSeries.add(method);
  }
  
  d3.selectAll("#stacked-legend .legend-item")
    .classed("inactive", function() {
      const label = d3.select(this).select(".legend-label").text();
      return hiddenSeries.has(label);
    });
  
  drawStackedArea();
}

// Main draw function
function drawStackedArea() {
  const container = d3.select("#q2-stacked");
  container.selectAll("svg").remove();
  
  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Aggregate by year
  const yearlyData = d3.rollups(
    rawData,
    v => {
      const obj = { year: v[0].YEAR };
      METHODS.forEach(m => {
        const filtered = v.filter(d => d.DETECTION_METHOD === m);
        obj[m] = d3.sum(filtered, d => d[metric]);
      });
      obj.total = obj["Police issued"] + obj["Camera issued"];
      return obj;
    },
    d => d.YEAR
  ).map(d => d[1]).sort((a, b) => a.year - b.year);

  // Convert to percentage if needed
  if (viewMode === "percent") {
    yearlyData.forEach(d => {
      const total = d.total;
      METHODS.forEach(m => {
        d[m] = total > 0 ? (d[m] / total) * 100 : 0;
      });
    });
  }

  // Filter out hidden series
  const visibleMethods = METHODS.filter(m => !hiddenSeries.has(m));

  // Stack data
  const stack = d3.stack()
    .keys(visibleMethods)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);

  const series = stack(yearlyData);

  // Scales
  const x = d3.scaleLinear()
    .domain(d3.extent(yearlyData, d => d.year))
    .range([0, width]);

  const maxY = viewMode === "percent" 
    ? 100 
    : d3.max(series, s => d3.max(s, d => d[1]));

  const y = d3.scaleLinear()
    .domain([0, maxY])
    .nice()
    .range([height, 0]);

  // Add grid
  svg.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y)
      .tickSize(-width)
      .tickFormat(""))
    .style("opacity", 0.1);

  // Area generator
  const area = d3.area()
    .x(d => x(d.data.year))
    .y0(d => y(d[0]))
    .y1(d => y(d[1]))
    .curve(d3.curveMonotoneX);

  // Draw areas with gradients
  const defs = svg.append("defs");
  
  visibleMethods.forEach(method => {
    const gradient = defs.append("linearGradient")
      .attr("id", `gradient-${method.replace(/\s+/g, "-")}`)
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");
    
    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", COLORS[method])
      .attr("stop-opacity", 0.8);
    
    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", COLORS[method])
      .attr("stop-opacity", 0.3);
  });

  svg.selectAll(".area-path")
    .data(series)
    .enter()
    .append("path")
    .attr("class", "area")
    .attr("d", area)
    .style("fill", d => `url(#gradient-${d.key.replace(/\s+/g, "-")})`)
    .style("stroke", d => COLORS[d.key])
    .style("stroke-width", 2)
    .on("mouseover", function(event, d) {
      // Highlight this area
      d3.selectAll(".area")
        .classed("inactive", function(dd) {
          return dd.key !== d.key;
        });
    })
    .on("mouseout", function() {
      d3.selectAll(".area").classed("inactive", false);
    });

  // Add crosshair
  const crosshair = svg.append("line")
    .attr("class", "crosshair")
    .attr("y1", 0)
    .attr("y2", height);

  // Add invisible overlay for mouse tracking
  svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .style("fill", "none")
    .style("pointer-events", "all")
    .on("mousemove", function(event) {
      const [mx] = d3.pointer(event);
      const year = Math.round(x.invert(mx));
      const data = yearlyData.find(d => d.year === year);
      
      if (data) {
        crosshair.attr("x1", x(year))
          .attr("x2", x(year))
          .classed("active", true);
        
        showTooltip(event, data, year);
      }
    })
    .on("mouseout", function() {
      crosshair.classed("active", false);
      hideTooltip();
    });

  const xAxis = svg.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x)
      .tickFormat(d3.format("d"))
      .tickValues(yearlyData.map(d => d.year))
      .tickSize(6));

  xAxis.selectAll("text")
    .style("font-size", "11px")
    .style("font-weight", "600")
    .style("fill", "#003366");

  xAxis.selectAll("line")
    .style("stroke", "#b0d4e8");

  xAxis.select(".domain")
    .style("stroke", "#b0d4e8")
    .style("stroke-width", "2px");

  // Y-axis with proper styling
  const yAxisFormat = viewMode === "percent" ? d => d + "%" : d3.format("~s");
  
  const yAxis = svg.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(y).tickFormat(yAxisFormat));

  yAxis.selectAll("text")
    .style("font-size", "12px")
    .style("font-weight", "600")
    .style("fill", "#003366");

  yAxis.selectAll("line")
    .style("stroke", "#b0d4e8");

  yAxis.select(".domain")
    .style("stroke", "#b0d4e8")
    .style("stroke-width", "2px");

  svg.append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height + 40)
    .attr("text-anchor", "middle")
    .style("font-size", "13px")
    .style("font-weight", "600")
    .text("Year");

  svg.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -70)
    .attr("text-anchor", "middle")
    .style("font-size", "13px")
    .style("font-weight", "600")
    .text(metric === "TOTAL_FINES" ? "Total Fines" : "Fines per 10k Licences");

  const cameraStartX = x(2020);
  
  // Vertical dashed line
  svg.append("line")
    .attr("class", "annotation-line")
    .attr("x1", cameraStartX)
    .attr("x2", cameraStartX)
    .attr("y1", 0)
    .attr("y2", height)
    .style("stroke", "#D55E00")
    .style("stroke-width", 2)
    .style("stroke-dasharray", "6,4")
    .style("opacity", 0.6);

  // Annotation box with background
  const annotationGroup = svg.append("g")
    .attr("class", "annotation-group");

  // Background rectangle for text
  const annotationText = "Camera Detection Introduced";
  const textBBox = { width: 160, height: 50 };

  // Icon
  annotationGroup.append("text")
    .attr("x", cameraStartX + 20)
    .attr("y", 40)
    .style("font-size", "20px")
    .text("📷");

  // Main text
  annotationGroup.append("text")
    .attr("x", cameraStartX + 45)
    .attr("y", 38)
    .style("font-size", "11px")
    .style("font-weight", "700")
    .style("fill", "#2d3748")
    .text("Camera Detection");

  annotationGroup.append("text")
    .attr("x", cameraStartX + 45)
    .attr("y", 52)
    .style("font-size", "11px")
    .style("font-weight", "700")
    .style("fill", "#2d3748")
    .text("Introduced (2020)");
}

// Tooltip functions
function showTooltip(event, data, year) {
  let html = `<strong>${year}</strong>`;
  
  METHODS.forEach(method => {
    if (!hiddenSeries.has(method)) {
      const value = viewMode === "percent" 
        ? data[method].toFixed(1) + "%" 
        : data[method].toLocaleString();
      
      html += `
        <div class="tooltip-row">
          <span class="tooltip-label">
            <span class="tooltip-color" style="background: ${COLORS[method]}"></span>
            ${method}
          </span>
          <span class="tooltip-value">${value}</span>
        </div>
      `;
    }
  });

  tooltip.style("opacity", 1)
    .html(html)
    .style("left", (event.pageX + 15) + "px")
    .style("top", (event.pageY - 10) + "px");
}

function hideTooltip() {
  tooltip.style("opacity", 0);
}

// Export functionality
document.getElementById("export-stacked").addEventListener("click", () => {
  const svg = document.querySelector("#q2-stacked svg");
  if (!svg) return;
  
  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const img = new Image();
  
  canvas.width = svg.width.baseVal.value;
  canvas.height = svg.height.baseVal.value;
  
  img.onload = () => {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "stacked-area-chart.png";
      a.click();
      URL.revokeObjectURL(url);
    });
  };
  
  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
});