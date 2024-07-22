import fs from 'fs';
import _ from 'lodash';

// execute renderChartData with passed arguments 1 2 and 3
import {chart as rawChart} from '@rawgraphs/rawgraphs-core';
import {
  alluvialdiagram,
  arcdiagram,
  barchart,
  barchartmultiset,
  barchartstacked,
  beeswarm,
  bigNumber,
  boxplot,
  bubblechart,
  bumpchart,
  circlepacking,
  circularDendrogram,
  contourPlot,
  convexHull,
  dendrogram,
  echartsAreastack,
  echartsAreatimeaxis,
  echartsBarchart,
  echartsBubblechart,
  echartsCirclepacking,
  echartsCirculargraph,
  echartsForcegraph,
  echartsGeomap,
  echartsGraphgl,
  echartsHeatmap,
  echartsLinechart,
  echartsMultisetBarchart,
  echartsPiechart,
  echartsRadarchart,
  echartsSankey,
  echartsScatterchart,
  echartsStackedBarchart,
  echartsSunburst,
  echartsTreemap,
  ganttChart,
  hexagonalBinning,
  horizongraph,
  linechart,
  matrixplot,
  parallelcoordinates,
  piechart,
  radarchart,
  sankeydiagram,
  slopechart,
  streamgraph,
  sunburst,
  treemap,
  violinplot,
  voronoidiagram,
  voronoitreemap,
} from './rawgraphs-charts/lib/index.cjs.js';

import {winstonLogger} from './winston-logger.js';

// consts
const charts = {
  alluvialdiagram,
  arcdiagram,
  barchart,
  barchartmultiset,
  barchartstacked,
  beeswarm,
  boxplot,
  bubblechart,
  bumpchart,
  // calendarHeatmap,
  circlepacking,
  circularDendrogram,
  contourPlot,
  convexHull,
  dendrogram,
  ganttChart,
  hexagonalBinning,
  horizongraph,
  linechart,
  matrixplot,
  parallelcoordinates,
  piechart,
  radarchart,
  sankeydiagram,
  slopechart,
  streamgraph,
  sunburst,
  treemap,
  violinplot,
  voronoidiagram,
  voronoitreemap,
  echartsSankey,
  echartsGeomap,
  echartsTreemap,
  echartsBarchart,
  echartsLinechart,
  echartsSunburst,
  echartsPiechart,
  echartsCirclepacking,
  echartsForcegraph,
  echartsCirculargraph,
  echartsBubblechart,
  echartsAreastack,
  echartsHeatmap,
  echartsRadarchart,
  echartsGraphgl,
  echartsAreatimeaxis,
  echartsScatterchart,
  echartsMultisetBarchart,
  echartsStackedBarchart,
  bigNumber,
};

// utils
function getDatasetFilterOptions(dataset, dataTypes, onlyKeys) {
  const filterOptions = [];
  if (!dataset || dataset.length === 0) {
    return filterOptions;
  }
  const itemKeys = _.filter(Object.keys(dataset[0]), key => {
    return (
      key !== 'id' &&
      !key.toLowerCase().includes('amount') &&
      !key.toLowerCase().includes('date') &&
      !key.toLowerCase().includes('number') &&
      !key.toLowerCase().includes('title')
    );
  });

  if (onlyKeys) return itemKeys;

  itemKeys.forEach(key => {
    const options = _.filter(
      Object.keys(_.groupBy(dataset, key)),
      optionKey =>
        optionKey !== 'undefined' && optionKey !== 'null' && optionKey !== '',
    );
    const name = key;

    if (options.length > 0) {
      filterOptions.push({
        name,
        enabled: true,
        options: _.orderBy(
          _.uniq(options)
            .map(o => (dataTypes[key] === 'number' ? Number(o) : o))
            .map(o => ({
              label: o,
              value: o,
            })),
          'label',
          dataTypes[key] === 'number' ? 'desc' : 'asc',
        ),
      });
    }
  });

  return filterOptions;
}

function filterData(parsedDataset, appliedFilters) {
  // Get the filter keys
  const filterKeys = Object.keys(appliedFilters || {});
  if (filterKeys.length === 0) return parsedDataset; // can't be 0, but safety return

  // Filter 'data' based on 'appliedFilters' using the specified 'filterKeys'
  const filteredData = _.filter(parsedDataset, item => {
    // Check if all conditions hold for each 'filterKey'
    return filterKeys.every(filterKey =>
      appliedFilters[filterKey]?.includes(item[filterKey]),
    );
  });

  return filteredData;
}

function renderChart(
  item,
  parsed,
  initialParsedDataset,
  id,
  itemAppliedFilters,
  vizType,
) {
  const chart = charts[vizType];
  let header = '';
  let subheader = '';
  let unitofmeasurement = '';
  let mainKPImetric = '';

  try {
    if (vizType === 'bigNumber') {
      // extract header, subheader, unitofmeasurement from item.mapping
      header = item.mapping.header;
      subheader = item.mapping.subheader;
      unitofmeasurement = item.mapping.unitofmeasurement;
      mainKPImetric = item.mapping.mainKPImetric;
    }

    const viz = rawChart(chart, {
      data: parsed.dataset,
      mapping:
        vizType === 'bigNumber' ? {metric: item.mapping.metric} : item.mapping,
      visualOptions: item.vizOptions,
      dataTypes: parsed.dataTypes,
    });

    let vizData = viz._getVizData();

    if (vizType === 'bigNumber') {
      // remove header, subheader, unitofmeasurement from item.mapping
      vizData = {
        header: header ?? 'tmp',
        metric: vizData.metric,
        mainKPImetric: mainKPImetric,
        subheader: subheader ?? 'tmp',
        unitofmeasurement: unitofmeasurement ?? 'tmp',
      };
    }

    let tabItem = {
      renderedContent: '',
      appliedFilters: itemAppliedFilters || item.appliedFilters,
      filterOptionGroups: getDatasetFilterOptions(
        initialParsedDataset,
        parsed.dataTypes,
      ),
      enabledFilterOptionGroups: item.enabledFilterOptionGroups,
      dataTypes: parsed.dataTypes,
      mappedData: vizData,
      dimensions: chart.dimensions,
      ssr: false,
    };
    if (id !== 'new') {
      tabItem = {
        ...tabItem,
        mapping: item.mapping,
        vizType: item.vizType,
        datasetId: item.datasetId,
        vizOptions: item.vizOptions,
      };
    }
    return tabItem;
  } catch (e) {
    console.log(e);
    winstonLogger.error(
      `route <utils/renderchart/index.js>;fn <renderChart()>: Error rendering chart: ${e}`,
    );
  }
}

export async function renderChartData(id, body, chartData) {
  winstonLogger.debug(
    `route <utils/renderchart/index.js>;fn <renderChartData()>: Starting render chart process for chart with id: ${id}`,
  );

  let internalData;
  if (id === 'new' || body.rows) {
    if (!body.rows || body.rows.length === 0) {
      winstonLogger.error(
        `route <utils/renderchart/index.js>;fn <renderChartData()>: Error rendering chart: No rows`,
      );
      return {error: 'no rows'};
    }
    internalData = body.rows;
  } else {
    internalData = [[chartData]];
  }
  // at this point, this render function is always used to render a single chart.
  // we can assume that we only take the data item at data[0][0].
  // content is never in item anymore.
  // read the item and get the relevant parsed-data-file as json
  let item = internalData[0][0];
  let parsed = null;

  try {
    const filePath =
      process.env.PARSED_DATA_FILES_PATH || `../dx.backend/parsed-data-files/`;
    const parsedData = fs.readFileSync(`${filePath}${item?.datasetId}.json`);
    parsed = JSON.parse(parsedData.toString());
  } catch (error) {
    winstonLogger.error(
      `route <utils/renderchart/index.js>;fn <renderChartData()>: Error reading parsed data file: ${error}`,
    );
    console.log('Error reading parsed data file', error);
  }
  // Check if there are either filters in the item.appliedFilters or in the body.previewAppliedFilters
  const itemAppliedFilters = _.get(body, `previewAppliedFilters[0][0]`, null);
  const initialParsedDataset = parsed.dataset;
  // If there are filters, filter the data
  if (!_.isEmpty(item.appliedFilters) || itemAppliedFilters) {
    parsed.dataset = filterData(
      parsed.dataset,

      itemAppliedFilters || item.appliedFilters,
    );
  }
  let renderedChart;
  try {
    // render the chart
    renderedChart = renderChart(
      item,
      parsed,
      initialParsedDataset,
      id,
      itemAppliedFilters,
      item.vizType,
    );
    // Return the rendered chart item
    // json stringify and save to ./rendered.json
    fs.writeFileSync(
      `${__dirname}/rendering/${id}_rendered.json`,
      JSON.stringify(renderedChart),
    );
    winstonLogger.debug(
      `route <utils/renderchart/index.js>;fn <renderChartData()>: Render chart success`,
    );
    console.log('Success...');
  } catch (e) {
    console.log(e);
    winstonLogger.error(
      `route <utils/renderchart/index.js>;fn <renderChartData()>: Error rendering chart: ${e}`,
    );
  }
}

try {
  // if argv2 is undefined, return error
  if (process.argv[2] === undefined) {
    winstonLogger.error(
      'route <utils/renderchart/index.js>: process.argv[2] undefined',
    );
    console.error('No id provided');
  } else {
    winstonLogger.debug(
      `route <utils/renderchart/index.js>: process.argv[2]: ${process.argv[2]}`,
    );

    // read the first argument as id
    const id = process.argv[2]; // 2 because 0 is node and 1 is this file
    // read the data from ./source_data.json as json
    const data = fs.readFileSync(`${__dirname}/rendering/${id}.json`);
    const parsedData = JSON.parse(data);
    const body = parsedData.body;
    const chartData = parsedData.chartData;
    renderChartData(id, body, chartData);
    winstonLogger.debug(
      `route <utils/renderchart/index.js>: Rendered chart with id: ${id}`,
    );
  }
} catch (error) {
  winstonLogger.error(
    `route <utils/renderchart/index.js>: Error rendering chart: ${'error'}`,
  );
  console.error('Something went wrong...\n');
}
